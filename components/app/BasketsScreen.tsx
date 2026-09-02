"use client";

import { useCallback, useEffect, useState } from "react";
import { authedGet, authedPost } from "@/lib/client-api";
import { BasketCard, type CommunityBasket } from "@/components/baskets/BasketCard";
import { useLocale } from "./LocaleProvider";

/** Same filters as /baskets, so the two surfaces stay one product. */
const FEED_TABS = ["all", "hot", "following", "bought"] as const;
type FeedTab = (typeof FEED_TABS)[number];

// Root-topic chips, same set the web feed shows — keys are the topic-tree
// root slugs the API filters by. `all` sends no filter.
const FEED_CATS = [
  { key: "all", emoji: "" },
  { key: "sports", emoji: "⚽" },
  { key: "crypto", emoji: "🪙" },
  { key: "politics", emoji: "🗳" },
  { key: "economy", emoji: "📈" },
  { key: "iran", emoji: "🇮🇷" },
] as const;
type FeedCat = (typeof FEED_CATS)[number]["key"];

/**
 * Baskets: browse a curated set of positions, then buy the whole set at once.
 *
 * The split shown before confirming comes from the SERVER (`/webapp/v1/basket`
 * with the chosen size), and the buy re-derives it server-side from the same
 * size. The client never proposes weights or prices — if it did, a crafted
 * request could size legs itself and route around the slippage cap.
 */

/**
 * The in-app list is the SAME feed as /baskets, rendered with the same card.
 *
 * It used to be its own endpoint and its own bare markup, which meant the
 * mini-app showed editorial baskets only and gave no hint that other people
 * publish here — the surface where someone is most likely to buy was the one
 * hiding most of the inventory. One query, one card, one ordering.
 */

type QuotedLeg = {
  /** Persian market title; null when untranslated. */
  titleFa?: string | null;
  marketId: string;
  slug: string;
  title: string;
  side: "YES" | "NO";
  weightBps: number;
  stakeUsdc: number;
  price: number | null;
  buyable: boolean;
  skipReason: string | null;
};

type BasketDetail = {
  slug: string;
  title: string;
  titleFa: string | null;
  description: string | null;
  descriptionFa: string | null;
  minStake: number;
  quotedFor: number;
  /** At most one leg can resolve YES — five contenders, one trophy. */
  exclusive: boolean;
  /**
   * What this stake returns if the basket comes good, computed server-side
   * because which figure is honest depends on `exclusive`. `allHit` is null on
   * an exclusive basket: that outcome cannot happen, so quoting it would
   * promise a return nobody can collect.
   */
  payout: {
    staked: number;
    allHit: number | null;
    multiple: number | null;
    singleLow: number | null;
    singleHigh: number | null;
    singleEven: number | null;
    singleMultiple: number | null;
  };
  legs: QuotedLeg[];
};

type ReceiptLeg = {
  slug: string;
  title: string;
  side: "YES" | "NO";
  requestedUsdc: number;
  filled: boolean;
  filledUsdc: number | null;
  avgPrice: number | null;
  reason: string | null;
};

export type BasketReceipt = {
  /** Purchase id — what /basket-retry re-attempts failed legs against. */
  buyId?: string | null;
  status: "filled" | "partial" | "failed";
  requestedUsdc: number;
  filledUsdc: number;
  legs: ReceiptLeg[];
};

/**
 * Leg failures worth offering a Retry for. Mirrors the server's own list —
 * the dominant case is the exchange counting a matched-but-unsettled earlier
 * leg against the wallet balance, which clears by itself within seconds.
 * `settled` and `below_min` stay out: retrying cannot change either.
 */
const RETRYABLE = new Set(["no_fill", "order_error", "price_moved", "no_quote", "unbuyable"]);

const PRESETS = [10, 25, 50, 100];

/** Per-leg colours, matching the weight bar on the web basket page. */
const LEG_COLORS = [
  "var(--bk-gold)", "#b08d2f", "#8a6f2a", "#6b5620", "#d9b356",
  "#a3853a", "#7d6a2e", "#5c4d1e", "#c9a44a", "#948038",
];

const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * The single payout figure when every winner pays the same, else null.
 *
 * Prefers the server's `singleEven`, but re-derives it from the low/high pair
 * when that field is missing or the two ends collapse to the same displayed
 * amount. Cent-rounding across five legs leaves a penny of spread, and "returns
 * between $144.92 and $144.93" is a range in name only — it reads as though the
 * winner changes the payout, which under equal-shares sizing it does not.
 */
function evenPayout(p: BasketDetail["payout"]): number | null {
  if (p.singleEven !== null) return p.singleEven;
  if (p.singleLow === null || p.singleHigh === null || p.singleHigh <= 0) return null;
  // Same 1% band the server uses, plus the display test: if both ends format to
  // the same string, a range is literally unreadable as one.
  const tight = (p.singleHigh - p.singleLow) / p.singleHigh <= 0.01;
  return tight ? (p.singleLow + p.singleHigh) / 2 : null;
}
const cents = (p: number | null) => (p === null ? "—" : `${Math.round(p * 100)}%`);

export function BasketsScreen({
  balance,
  onDone,
  initialSlug = null,
}: {
  balance: number | null;
  onDone: (receipt: BasketReceipt) => void;
  /**
   * Basket to open on mount, from a `/app?basket=<slug>` deep link. The card
   * loads by slug on its own, so an unknown or unpublished slug degrades to the
   * list rather than a dead screen.
   */
  initialSlug?: string | null;
}) {
  const { locale, t } = useLocale();
  const [list, setList] = useState<CommunityBasket[] | null>(null);
  const [tab, setTab] = useState<FeedTab>("all");
  const [cat, setCat] = useState<FeedCat>("all");
  /**
   * `query` is what the field shows; `search` is what has actually been sent.
   * Separating them is what makes the debounce work without the input feeling
   * laggy — the box updates on every keystroke, the request does not.
   */
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(initialSlug);

  // 250ms: long enough that a typed word is one request, short enough that the
  // list feels like it is following you rather than catching up.
  useEffect(() => {
    const id = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const ctrl = new AbortController();
    // Null while loading, so a tab change shows the skeleton rather than the
    // previous tab's results sitting under the newly-selected pill.
    setList(null);
    const qs = new URLSearchParams({ tab });
    if (cat !== "all") qs.set("category", cat);
    if (search) qs.set("q", search);
    authedGet<{ baskets: CommunityBasket[] }>(
      `/webapp/v1/community-baskets?${qs}`,
      ctrl.signal,
    )
      .then((d) => setList(d.baskets))
      .catch((e: unknown) => {
        if ((e as Error)?.name !== "AbortError") setList([]);
      });
    return () => ctrl.abort();
  }, [tab, cat, search]);

  if (open) {
    return (
      <BasketDetailScreen
        slug={open}
        balance={balance}
        onBack={() => setOpen(null)}
        onDone={onDone}
      />
    );
  }

  return (
    <section className="px-4 pt-4">
      <h1 className="text-[19px] font-bold tracking-[-0.02em]">{t.app.baskets.title}</h1>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--mute)]">{t.app.baskets.lead}</p>
      {/* Said up front: "buy several positions at once" reads as a parlay to
          anyone who has used a sportsbook, and that is the opposite of this. */}
      <p className="mt-2 text-[12px] leading-relaxed text-[var(--faint)]">
        {t.app.baskets.notParlay}
      </p>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.app.baskets.searchPlaceholder}
        className="mt-4 w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--faint)]"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {FEED_TABS.map((x) => {
          const on = x === tab;
          return (
            <button
              key={x}
              type="button"
              onClick={() => setTab(x)}
              className="rounded-full border px-3 py-1.5 text-[12px] font-semibold"
              style={{
                background: on ? "var(--bk-goldtint)" : "var(--card)",
                borderColor: on ? "#b08d2f" : "var(--line)",
                color: on ? "var(--bk-gold)" : "var(--mute)",
              }}
            >
              {t.communityBaskets.tabs[x]}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {FEED_CATS.map((x) => {
          const on = x.key === cat;
          return (
            <button
              key={x.key}
              type="button"
              onClick={() => setCat(x.key)}
              className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
              style={{
                background: on ? "var(--bk-goldtint)" : "transparent",
                borderColor: on ? "#b08d2f" : "var(--line)",
                color: on ? "var(--bk-gold)" : "var(--faint)",
              }}
            >
              {x.emoji && <span aria-hidden>{x.emoji} </span>}
              {t.communityBaskets.categories[x.key]}
            </button>
          );
        })}
      </div>

      {list === null ? (
        <div className="mt-6 space-y-2" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl border border-[var(--line)]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="mt-6 text-[13px] text-[var(--mute)]">
          {search ? t.app.baskets.noMatches.replace("{q}", search)
            : tab === "following" ? t.communityBaskets.emptyFollowing
            : cat !== "all" ? t.communityBaskets.emptyCategory
            : t.app.baskets.empty}
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {list.map((b) => (
            <BasketCard key={b.slug} basket={b} onOpen={setOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

function BasketDetailScreen({
  slug,
  balance,
  onBack,
  onDone,
}: {
  slug: string;
  balance: number | null;
  onBack: () => void;
  onDone: (receipt: BasketReceipt) => void;
}) {
  const { locale, t } = useLocale();
  const [detail, setDetail] = useState<BasketDetail | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-quote whenever the chosen size changes, so the split on screen is the
  // one the server will execute. Without a size, the API prices at a nominal
  // $100 and we render weights only.
  const load = useCallback(
    (forSize: number | null, signal?: AbortSignal) => {
      const qs = forSize ? `&size=${forSize}` : "";
      return authedGet<BasketDetail>(
        `/webapp/v1/basket?slug=${encodeURIComponent(slug)}${qs}`,
        signal,
      );
    },
    [slug],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(size, ctrl.signal)
      .then(setDetail)
      .catch((e: unknown) => {
        if ((e as Error)?.name !== "AbortError") setError(t.app.errors.unavailable);
      });
    return () => ctrl.abort();
  }, [load, size, t.app.errors.unavailable]);

  const title = detail ? (locale === "fa" ? (detail.titleFa ?? detail.title) : detail.title) : "";
  const min = detail?.minStake ?? 0;
  const affordable = PRESETS.filter((p) => p >= min);
  const tooSmall = size !== null && size < min;
  const tooBig = size !== null && balance !== null && size > balance;
  const skipped = detail ? detail.legs.filter((l) => !l.buyable).length : 0;

  async function buy() {
    if (!detail || size === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authedPost<BasketReceipt>("/webapp/v1/basket-buy", {
        slug: detail.slug,
        sizeUsdc: size,
      });
      onDone(res);
    } catch (e: unknown) {
      setError((e as Error)?.message || t.app.errors.unavailable);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="px-4 pt-4 pb-6">
      <button
        type="button"
        onClick={onBack}
        className="font-mono text-[11px] tracking-[0.06em] text-[var(--mute)]"
      >
        ← {t.app.baskets.title}
      </button>

      {detail === null ? (
        <div className="mt-6 h-40 rounded-2xl border border-[var(--line)]" aria-busy />
      ) : (
        <>
          <h1 className="mt-3 text-[19px] font-bold tracking-[-0.02em]">{title}</h1>
          <p className="ltr-num mt-1 font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
            {t.app.baskets.legs.replace("{count}", String(detail.legs.length))}
            {" · "}
            {t.app.baskets.minStake.replace("{amount}", min.toFixed(2))}
          </p>

          {/* Position cards. Each carries its own share of the stake, because
              "33%" and "$33 of your $100" are different questions and the
              second is the one being decided. */}
          <ul className="mt-4 space-y-2">
            {detail.legs.map((leg, i) => {
              const weightPct = leg.weightBps / 100;
              // What this leg alone returns if it resolves YES.
              const legPayout =
                size !== null && leg.buyable && leg.price ? leg.stakeUsdc / leg.price : null;
              return (
                <li
                  key={leg.marketId}
                  className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]"
                  style={{ opacity: leg.buyable ? 1 : 0.5 }}
                >
                  {/* Strip width = weight. Ties the row to its share without a
                      legend, and reads at a glance on a phone. */}
                  <div
                    className="h-[3px]"
                    style={{
                      width: `${weightPct}%`,
                      background: LEG_COLORS[i % LEG_COLORS.length],
                    }}
                  />
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[13px] leading-snug font-semibold">
                        {locale === "fa" ? (leg.titleFa ?? leg.title) : leg.title}
                      </span>
                      <span
                        className="ltr-num shrink-0 rounded-lg px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--text2)]"
                        style={{ background: "var(--btn)" }}
                      >
                        {weightPct.toFixed(0)}%
                      </span>
                    </div>

                    <p
                      dir="ltr"
                      className="mt-2 flex flex-wrap items-center gap-x-2 font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]"
                    >
                      <span
                        className="rounded-full px-1.5 py-0.5 font-bold"
                        style={{ background: "var(--bk-greenbg)", color: "var(--bk-green)" }}
                      >
                        {leg.side}
                      </span>
                      <span className="ltr-num">{cents(leg.price)}</span>
                    </p>

                    {/* Only once a real size is chosen. At the $100 preview these
                        would read as a promise about a stake nobody has set. */}
                    {size !== null && leg.buyable && legPayout !== null && (
                      <div className="mt-2 flex items-center justify-between border-t border-[var(--line)] pt-2 text-[11px]">
                        <span className="text-[var(--mute)]">
                          {t.app.baskets.yourShare}{" "}
                          <span className="ltr-num font-bold text-[var(--ink)]">
                            {money(leg.stakeUsdc)}
                          </span>
                        </span>
                        <span className="text-[var(--mute)]">
                          {t.app.baskets.ifItHits}{" "}
                          <span
                            className="ltr-num font-bold"
                            style={{ color: "var(--bk-gold)" }}
                          >
                            {money(legPayout)}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Amount. The chosen size, large, with the split it produces drawn
              underneath — the bar is the same one the web page shows. */}
          <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
            <p className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
              {t.app.baskets.amount}
            </p>
            <p dir="ltr" className="mt-1 text-[26px] leading-none font-extrabold tabular-nums">
              {size === null ? "—" : money(size)}
            </p>

            <div dir="ltr" className="mt-3 flex h-[14px] gap-[3px] overflow-hidden rounded-[7px]">
              {detail.legs.map((leg, i) => (
                <div
                  key={leg.marketId}
                  style={{
                    flexGrow: leg.weightBps,
                    flexBasis: 0,
                    background: LEG_COLORS[i % LEG_COLORS.length],
                  }}
                />
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {/* The minimum is always offered: on a basket with a small leg it
                  can be the only amount that clears every leg's floor. */}
              <AmountButton label={money(min)} active={size === min} onClick={() => setSize(min)} />
              {affordable.map((p) => (
                <AmountButton
                  key={p}
                  label={`$${p}`}
                  active={size === p}
                  onClick={() => setSize(p)}
                />
              ))}
            </div>
          </div>

          {/* Best case. Gold, because it is the number people scroll for — and
              immediately followed by the reason it is not a parlay, so the
              headline figure never stands alone. */}
          {detail.payout.staked > 0 && (
            <div
              className="mt-3 rounded-2xl border p-4"
              style={{ borderColor: "var(--bk-goldborder)", background: "var(--bk-goldtint)" }}
            >
              <p className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
                {t.app.baskets.payoutHeading}
              </p>
              {detail.payout.allHit !== null && detail.payout.multiple !== null ? (
                <>
                  <p
                    dir="ltr"
                    className="mt-1 text-[30px] leading-none font-extrabold tabular-nums"
                    style={{ color: "var(--bk-gold)" }}
                  >
                    {money(detail.payout.allHit)}
                    <span className="ml-2 text-[15px] font-bold opacity-80">
                      ×{detail.payout.multiple.toFixed(2)}
                    </span>
                  </p>
                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--text2)]">
                    {t.app.baskets.payoutAllHit
                      .replace("{amount}", money(detail.payout.allHit))
                      .replace("{stake}", money(detail.payout.staked))
                      .replace("{multiple}", detail.payout.multiple.toFixed(2))}
                  </p>
                </>
              ) : evenPayout(detail.payout) !== null ? (
                /* Equal shares: the winner doesn't change the payout, so one
                   figure rather than a range that implies it does. */
                <>
                  <p
                    dir="ltr"
                    className="mt-1 text-[30px] leading-none font-extrabold tabular-nums"
                    style={{ color: "var(--bk-gold)" }}
                  >
                    {money(evenPayout(detail.payout)!)}
                  </p>
                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--text2)]">
                    {t.app.baskets.payoutEven
                      .replace("{stake}", money(detail.payout.staked))
                      .replace("{amount}", money(evenPayout(detail.payout)!))
                      .replace(
                        "{multiple}",
                        (evenPayout(detail.payout)! / detail.payout.staked).toFixed(2),
                      )}
                  </p>
                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--mute)]">
                    {t.app.baskets.payoutEvenLead}
                  </p>
                </>
              ) : (
                detail.payout.singleLow !== null &&
                detail.payout.singleHigh !== null && (
                  <>
                    <p className="mt-1.5 text-[13px] leading-relaxed">
                      {t.app.baskets.payoutRange
                        .replace("{stake}", money(detail.payout.staked))
                        .replace("{low}", money(detail.payout.singleLow))
                        .replace("{high}", money(detail.payout.singleHigh))}
                    </p>
                    {detail.payout.singleLow < detail.payout.staked && (
                      <p className="mt-2 text-[12px] leading-relaxed text-[var(--mute)]">
                        {t.app.baskets.payoutRangeWarn}
                      </p>
                    )}
                  </>
                )
              )}
              <p className="mt-3 text-[12px] leading-relaxed text-[var(--mute)]">
                {t.app.baskets.notParlay}
              </p>
            </div>
          )}

          {skipped > 0 && (
            <p className="mt-3 text-[12px] text-[var(--mute)]">
              {t.app.baskets.skipping.replace("{count}", String(skipped))}
            </p>
          )}

          <p className="mt-3 text-[12px] leading-relaxed text-[var(--mute)]">
            {t.app.baskets.partialNotice}
          </p>

          {tooSmall && (
            <p className="mt-3 text-[12px] text-[var(--down)]">
              {t.app.baskets.belowMin.replace("{amount}", min.toFixed(2))}
            </p>
          )}
          {tooBig && (
            <p className="mt-3 text-[12px] text-[var(--down)]">{t.app.baskets.insufficient}</p>
          )}
          {error && <p className="mt-3 text-[12px] text-[var(--down)]">{error}</p>}

          <button
            type="button"
            onClick={buy}
            disabled={size === null || tooSmall || tooBig || busy}
            className="mt-5 w-full rounded-xl px-5 py-3.5 text-[15px] font-bold disabled:opacity-40"
            style={
              size === null || tooSmall || tooBig || busy
                ? { background: "var(--btn)", color: "var(--faint)" }
                : {
                    background: "var(--bk-cta)",
                    color: "var(--bk-cta-ink)",
                    boxShadow: "var(--bk-cta-shadow)",
                  }
            }
          >
            {busy
              ? t.app.baskets.buying
              : size === null
                ? t.app.baskets.buy
                : `${t.app.baskets.buy} · ${money(size)}`}
          </button>
        </>
      )}
    </section>
  );
}

function AmountButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="ltr-num flex-1 rounded-xl border px-2 py-2.5 text-[13px] font-semibold"
      style={{
        borderColor: active ? "var(--accent)" : "var(--line)",
        color: active ? "var(--accent)" : "var(--text2)",
      }}
    >
      {label}
    </button>
  );
}

/** The per-leg account of a basket purchase. */
export function BasketReceiptScreen({
  receipt: initial,
  onPositions,
  onDone,
}: {
  receipt: BasketReceipt;
  onPositions: () => void;
  onDone: () => void;
}) {
  const { t } = useLocale();
  const b = t.app.baskets;
  // Local: a retry replaces the receipt in place, same screen.
  const [receipt, setReceipt] = useState(initial);
  const [retrying, setRetrying] = useState(false);
  const [retryErr, setRetryErr] = useState<string | null>(null);
  const unspent = receipt.requestedUsdc - receipt.filledUsdc;

  const canRetry =
    Boolean(receipt.buyId) &&
    receipt.legs.some((l) => !l.filled && l.reason != null && RETRYABLE.has(l.reason));

  async function retry() {
    if (!receipt.buyId || retrying) return;
    setRetrying(true);
    setRetryErr(null);
    try {
      const res = await authedPost<BasketReceipt>("/webapp/v1/basket-retry", {
        buyId: receipt.buyId,
      });
      setReceipt(res);
    } catch {
      setRetryErr(b.retryError);
    } finally {
      setRetrying(false);
    }
  }

  const reasonText = (reason: string | null) => {
    switch (reason) {
      case "no_fill":
        return b.reasonNoFill;
      case "settled":
        return b.reasonSettled;
      case "unbuyable":
        return b.reasonUnbuyable;
      case "no_quote":
        return b.reasonNoQuote;
      case "below_min":
        return b.reasonBelowMin;
      default:
        return b.reasonError;
    }
  };

  return (
    <section className="px-4 pt-6">
      <h1 className="text-[19px] font-bold tracking-[-0.02em]">
        {receipt.status === "filled"
          ? b.boughtTitle
          : receipt.status === "partial"
            ? b.partialTitle
            : b.failedTitle}
      </h1>
      <p className="ltr-num mt-1 font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]">
        {b.filledOf
          .replace("{filled}", receipt.filledUsdc.toFixed(2))
          .replace("{requested}", receipt.requestedUsdc.toFixed(2))}
      </p>

      <ul className="mt-5 space-y-2">
        {receipt.legs.map((leg) => (
          <li key={leg.slug} className="rounded-2xl border border-[var(--line)] p-3">
            <div className="flex items-start justify-between gap-3">
              {/* Receipt legs come from the buy-time snapshot in
                  basket_buys.legs, which stores the English title — a receipt
                  must keep saying what was actually bought even if the basket
                  is later edited or retranslated. */}
              <span className="text-[13px] leading-snug">{leg.title}</span>
              <span
                className="shrink-0 text-[13px]"
                style={{ color: leg.filled ? "var(--up)" : "var(--down)" }}
                aria-hidden
              >
                {leg.filled ? "✓" : "✗"}
              </span>
            </div>
            <p className="ltr-num mt-1.5 font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
              {leg.filled
                ? `${leg.side} · ${money(leg.filledUsdc ?? leg.requestedUsdc)} @ ${cents(leg.avgPrice)}`
                : reasonText(leg.reason)}
            </p>
          </li>
        ))}
      </ul>

      {/* Only claimed when there is actually money left over — "$0.00 stayed in
          your balance" on a clean fill reads as a partial. */}
      {unspent >= 0.01 && (
        <p className="ltr-num mt-4 text-[12px] text-[var(--mute)]">
          {b.unspent.replace("{amount}", unspent.toFixed(2))}
        </p>
      )}

      {canRetry && (
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="mt-4 w-full rounded-xl border px-4 py-3 text-[14px] font-bold disabled:opacity-60"
          style={{
            borderColor: "var(--bk-goldborder)",
            background: "var(--bk-goldtint)",
            color: "var(--bk-gold)",
          }}
        >
          {retrying ? b.retrying : b.retryFailed}
        </button>
      )}
      {retryErr && <p className="mt-2 text-[12px] text-[var(--down)]">{retryErr}</p>}

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={onPositions}
          className="flex-1 rounded-xl border border-[var(--line)] px-4 py-3 text-[14px] font-semibold"
        >
          {b.viewPositions}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex-1 rounded-xl bg-[var(--accent)] px-4 py-3 text-[14px] font-semibold text-[var(--on-accent)]"
        >
          {b.done}
        </button>
      </div>
    </section>
  );
}
