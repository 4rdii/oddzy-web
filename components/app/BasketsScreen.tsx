"use client";

import { useCallback, useEffect, useState } from "react";
import { authedGet, authedPost } from "@/lib/client-api";
import { useLocale } from "./LocaleProvider";

/**
 * Baskets: browse a curated set of positions, then buy the whole set at once.
 *
 * The split shown before confirming comes from the SERVER (`/webapp/v1/basket`
 * with the chosen size), and the buy re-derives it server-side from the same
 * size. The client never proposes weights or prices — if it did, a crafted
 * request could size legs itself and route around the slippage cap.
 */

type BasketSummary = {
  slug: string;
  title: string;
  titleFa: string | null;
  description: string | null;
  descriptionFa: string | null;
  curated: boolean;
  legCount: number;
  buys: number;
};

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
  status: "filled" | "partial" | "failed";
  requestedUsdc: number;
  filledUsdc: number;
  legs: ReceiptLeg[];
};

const PRESETS = [10, 25, 50, 100];

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
  const [list, setList] = useState<BasketSummary[] | null>(null);
  const [open, setOpen] = useState<string | null>(initialSlug);

  useEffect(() => {
    const ctrl = new AbortController();
    authedGet<{ baskets: BasketSummary[] }>("/webapp/v1/baskets", ctrl.signal)
      .then((d) => setList(d.baskets))
      .catch((e: unknown) => {
        if ((e as Error)?.name !== "AbortError") setList([]);
      });
    return () => ctrl.abort();
  }, []);

  const title = (b: { title: string; titleFa: string | null }) =>
    locale === "fa" ? (b.titleFa ?? b.title) : b.title;
  const blurb = (b: { description: string | null; descriptionFa: string | null }) =>
    (locale === "fa" ? (b.descriptionFa ?? b.description) : b.description) ?? "";

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

      {list === null ? (
        <div className="mt-6 space-y-2" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl border border-[var(--line)]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="mt-6 text-[13px] text-[var(--mute)]">{t.app.baskets.empty}</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {list.map((b) => (
            <li key={b.slug}>
              <button
                type="button"
                onClick={() => setOpen(b.slug)}
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 text-start"
              >
                <span className="block text-[15px] font-semibold">{title(b)}</span>
                {blurb(b) && (
                  <span className="mt-1 block text-[12px] leading-relaxed text-[var(--mute)]">
                    {blurb(b)}
                  </span>
                )}
                <span className="ltr-num mt-2 block font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
                  {t.app.baskets.legs.replace("{count}", String(b.legCount))}
                </span>
              </button>
            </li>
          ))}
        </ul>
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

          {/* What comes back if it lands. Sits above the legs because it is the
              number people scroll for, and it re-derives on every size change
              along with the quote it belongs to. */}
          {detail.payout.staked > 0 && (
            <div className="mt-4 rounded-2xl border border-[var(--line)] p-4">
              <p className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
                {t.app.baskets.payoutHeading}
              </p>
              {detail.payout.allHit !== null && detail.payout.multiple !== null ? (
                <p className="mt-1.5 text-[13px] leading-relaxed">
                  {t.app.baskets.payoutAllHit
                    .replace("{amount}", money(detail.payout.allHit))
                    .replace("{stake}", money(detail.payout.staked))
                    .replace("{multiple}", detail.payout.multiple.toFixed(2))}
                </p>
              ) : evenPayout(detail.payout) !== null ? (
                /* Equal shares: the winner doesn't change the payout, so one
                   figure rather than a range that implies it does. */
                <>
                  <p className="mt-1.5 text-[13px] leading-relaxed">
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
            </div>
          )}

          <ul className="mt-4 space-y-2">
            {detail.legs.map((leg) => (
              <li
                key={leg.marketId}
                className="rounded-2xl border border-[var(--line)] p-3"
                style={{ opacity: leg.buyable ? 1 : 0.5 }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[13px] leading-snug">
                    {locale === "fa" ? (leg.titleFa ?? leg.title) : leg.title}
                  </span>
                  <span className="ltr-num shrink-0 font-mono text-[12px] font-bold">
                    {(leg.weightBps / 100).toFixed(0)}%
                  </span>
                </div>
                <p className="ltr-num mt-1.5 font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
                  {leg.side} · {cents(leg.price)}
                  {/* Only meaningful once a real size is chosen; at the $100
                      preview it would read as a promise about the stake. */}
                  {size !== null && leg.buyable && <> · {money(leg.stakeUsdc)}</>}
                </p>
              </li>
            ))}
          </ul>

          {skipped > 0 && (
            <p className="mt-3 text-[12px] text-[var(--mute)]">
              {t.app.baskets.skipping.replace("{count}", String(skipped))}
            </p>
          )}

          <p className="mt-4 text-[12px] leading-relaxed text-[var(--mute)]">
            {t.app.baskets.notParlay}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--mute)]">
            {t.app.baskets.partialNotice}
          </p>

          <div className="mt-5">
            <p className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
              {t.app.baskets.amount}
            </p>
            <div className="mt-2 flex gap-2">
              {/* The minimum is always offered: on a basket with a small leg it
                  can be the only amount that clears every leg's floor. */}
              <AmountButton
                label={money(min)}
                active={size === min}
                onClick={() => setSize(min)}
              />
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
            className="mt-5 w-full rounded-xl bg-[var(--accent)] px-5 py-3.5 text-[15px] font-semibold text-[var(--on-accent)] disabled:opacity-40"
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
  receipt,
  onPositions,
  onDone,
}: {
  receipt: BasketReceipt;
  onPositions: () => void;
  onDone: () => void;
}) {
  const { t } = useLocale();
  const b = t.app.baskets;
  const unspent = receipt.requestedUsdc - receipt.filledUsdc;

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
