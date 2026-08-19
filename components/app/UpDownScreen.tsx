"use client";

import { useEffect, useMemo, useState } from "react";
import type { Market, SettledUpDownWindow, UpDownWindow } from "@/lib/api";
import { cents, payoutFor, usd } from "@/lib/format";
import { authedPost, ApiCallError } from "@/lib/client-api";
import { useTelegram } from "@/lib/telegram";
import { useLocale } from "./LocaleProvider";
import { PriceChart, useWindowPrices } from "../updown/PriceChart";
import type { PlacedBet } from "./MarketDetail";

/**
 * Up or Down, tradeable.
 *
 * The public /updown page is a shop window — it shows the instrument and sends
 * the reader to Telegram. This is the same instrument with a bet slip on it, and
 * it is the only surface in the app where the market a user is looking at can
 * expire while they look at it. Almost every decision below follows from that.
 *
 * It reuses the PUBLIC /api/updown feed rather than an authenticated one,
 * because window prices are public data and the proxy already exists. Only
 * placement is authenticated, through the same /webapp/v1/bet the chat flow and
 * MarketDetail use — so the lock, the slippage cap, the picks row and rev-share
 * accrual cannot drift between surfaces. There is no up/down-specific money path.
 */

const POLL_MS = 5000;

/** Stake chips. Lower than MarketDetail's: these are fifteen-minute punts. */
const STAKE_CHIPS = [5, 10, 25, 50];

/**
 * Seconds before close at which we stop offering the window.
 *
 * This mirrors the bot's own guard, and it is not cosmetic. These books converge
 * hard toward expiry — a market that opened near 0.51 is routinely 0.03 with two
 * minutes to run — so a bet placed in the last stretch is priced against a book
 * that has already decided. The bet ENDPOINT does not enforce this (it is a
 * generic market endpoint), so if this guard is wrong the user really can buy
 * into a settled outcome. Keep it.
 */
const CUTOFF_S = 120;

/** Window length, used to tell a running window from a scheduled one. */
const WINDOW_SECONDS = 900;

type Coin = { glyph: string; color: string; decimals: number; name: string };

const COINS: Record<string, Coin> = {
  BTC: { glyph: "₿", color: "#f7931a", decimals: 2, name: "Bitcoin" },
  ETH: { glyph: "Ξ", color: "#627eea", decimals: 2, name: "Ethereum" },
  SOL: { glyph: "◎", color: "#9945ff", decimals: 2, name: "Solana" },
};
const FALLBACK_COIN: Coin = { glyph: "◆", color: "var(--accent)", decimals: 2, name: "" };
const COIN_ORDER = ["BTC", "ETH", "SOL"];

export function UpDownScreen({
  onPlaced,
  balance,
}: {
  onPlaced: (bet: PlacedBet) => void;
  balance: number | null;
}) {
  const { t, tf, locale } = useLocale();
  const { inTelegram } = useTelegram();

  const [windows, setWindows] = useState<UpDownWindow[]>([]);
  const [settled, setSettled] = useState<SettledUpDownWindow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [asset, setAsset] = useState<string | null>(null);
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [stake, setStake] = useState(10);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  /**
   * Poll the public board. Written with `.then` rather than an awaited helper so
   * the state updates land in a promise callback — the same shape BasketsScreen
   * uses, and the one the react-hooks rules recognise as "subscribing to an
   * external system" rather than cascading renders out of an effect body.
   */
  useEffect(() => {
    const ctrl = new AbortController();
    const tick = () => {
      fetch("/api/updown", { cache: "no-store", signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { windows?: UpDownWindow[]; settled?: SettledUpDownWindow[] } | null) => {
          if (!d) return;
          setWindows(d.windows ?? []);
          setSettled(d.settled ?? []);
          setLoaded(true);
        })
        .catch(() => {
          // Transient or aborted. Keep the last good board rather than blanking
          // a screen someone is mid-trade on.
        });
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      clearInterval(id);
      ctrl.abort();
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const assets = useMemo(() => {
    const seen = new Set(windows.map((w) => w.asset));
    return [...seen].sort((a, b) => {
      const ia = COIN_ORDER.indexOf(a);
      const ib = COIN_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [windows]);

  const active = asset && assets.includes(asset) ? asset : assets[0] ?? null;

  /**
   * The running window for the selected coin.
   *
   * Chosen by the API's `seconds_left` rather than by comparing timestamps to
   * the device clock: a phone running a few minutes fast would otherwise decide
   * the live window had already closed and show an empty screen.
   */
  const live = useMemo(() => {
    if (!active) return null;
    return (
      windows.find(
        (w) =>
          w.asset === active &&
          w.seconds_left != null &&
          w.seconds_left > 0 &&
          w.seconds_left <= WINDOW_SECONDS,
      ) ?? null
    );
  }, [windows, active]);

  const next = useMemo(() => {
    if (!active) return null;
    return (
      windows
        .filter((w) => w.asset === active && w.seconds_left != null && w.seconds_left > WINDOW_SECONDS)
        .sort((a, b) => (a.seconds_left ?? 0) - (b.seconds_left ?? 0))[0] ?? null
    );
  }, [windows, active]);

  const series = useWindowPrices(live?.slug ?? "", true, live == null);

  // Countdown from the wall clock once mounted, falling back to the API's own
  // seconds_left so the first paint shows a real number rather than a dash.
  const endMs = live?.window_end ? new Date(live.window_end).getTime() : null;
  const left =
    now != null && endMs != null
      ? Math.max(0, Math.floor((endMs - now) / 1000))
      : (live?.seconds_left ?? null);

  /*
   * Unknown time counts as closing, not as open.
   *
   * `left` is null only if the API gave us no seconds_left AND the clock has not
   * started — rare, but the failure directions are not symmetric: treating an
   * unknown deadline as tradable can sell someone a window that has already
   * decided, while treating it as closed costs them one refresh.
   */
  const closing = left == null || left < CUTOFF_S;
  const coin = (active && COINS[active]) || FALLBACK_COIN;

  const upPrice = live?.up_price ?? null;
  const downPrice = live?.down_price ?? null;
  const price = side === "YES" ? upPrice : downPrice;
  const shares = price != null && price > 0 ? stake / price : 0;
  const payout = price != null && price > 0 ? payoutFor(stake, price) : 0;
  const insufficient = balance != null && stake > balance;
  const tradable = live != null && !closing && price != null && price > 0;

  async function place() {
    if (!live || !tradable) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await authedPost<{
        filledShares: number;
        costUsd: number;
        avgPrice: number;
        orderId: string | null;
        txHash: string | null;
      }>("/webapp/v1/bet", { marketId: live.market_id, side, sizeUsdc: stake });

      /*
       * The receipt wants a Market and a window is not one. Rather than widen
       * PlacedBet — which would push an optional shape through Receipt,
       * Positions and everything else that consumes it — the window is dressed
       * as the minimal Market the receipt actually reads: a title and a close
       * time. The title is built here because the API deliberately does not
       * return one; Polymarket titles these in ET, which is meaningless to a
       * Tehran reader, so it is composed in the reader's own locale.
       */
      const title = `${coin.name || live.asset} ${side === "YES" ? t.app.updown.up : t.app.updown.down} · ${windowLabel(live, locale)}`;
      onPlaced({
        market: { title, close_time: live.window_end } as unknown as Market,
        side,
        stake: data.costUsd,
        price: data.avgPrice,
        shares: data.filledShares,
        payout: data.filledShares,
        txHash: data.txHash,
        orderId: data.orderId,
      });
      setSheetOpen(false);
    } catch (e) {
      const server = (e as ApiCallError & { serverMessage?: string })?.serverMessage;
      if (e instanceof ApiCallError && e.kind === "unauthenticated") {
        setError(inTelegram ? t.app.errors.telegramSession : t.app.bet.sessionExpired);
      } else {
        setError(server ?? t.app.bet.failed);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const anchor = series?.anchor ?? null;
  const lastPoint = series?.points[series.points.length - 1] ?? null;
  const fmtPrice = (v: number) =>
    `$${v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v.toFixed(coin.decimals)}`;
  const delta = lastPoint && anchor != null ? lastPoint.twap - anchor : null;
  const winning = delta != null && delta >= 0;

  if (!loaded) {
    return <p className="px-4 py-10 text-center text-[14px] text-[var(--mute)]">{t.app.updown.loading}</p>;
  }

  return (
    <div className="pb-28">
      <div className="px-4 pt-4">
        <h1 className="text-[20px] font-bold tracking-[-0.02em]">{t.app.updown.title}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--mute)]">{t.app.updown.rule}</p>
      </div>

      {assets.length > 0 && (
        <div className="mt-4 flex gap-2 px-4">
          {assets.map((a) => {
            const c = COINS[a] ?? FALLBACK_COIN;
            const on = a === active;
            return (
              <button
                key={a}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setAsset(a);
                  setSheetOpen(false);
                }}
                className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl text-[14px] font-semibold transition-colors ${
                  on
                    ? "bg-[var(--ink)] text-[var(--on-ink)]"
                    : "border border-[var(--line)] bg-[var(--btn)] text-[var(--mute)]"
                }`}
              >
                <span style={{ color: on ? c.color : undefined }} aria-hidden>
                  {c.glyph}
                </span>
                {a}
              </button>
            );
          })}
        </div>
      )}

      {live == null ? (
        <p className="px-4 py-10 text-center text-[14px] text-[var(--mute)]">{t.app.updown.none}</p>
      ) : (
        <>
          <div className="mx-4 mt-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[15px] font-bold">
                  {coin.name || live.asset} · {t.app.updown.interval}
                </div>
                <div className="mt-0.5 text-[12px] text-[var(--faint)]">
                  {now != null && (
                    <span className="ltr-num">{windowLabel(live, locale)}</span>
                  )}
                </div>
              </div>
              <div className="text-end">
                <div
                  className="ltr-num text-[26px] font-bold tabular-nums"
                  style={{ color: closing ? "var(--down)" : "var(--ink)" }}
                >
                  {left == null
                    ? "—"
                    : `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`}
                </div>
                <div className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
                  {closing ? t.app.updown.closing : t.app.updown.closesIn}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              <div>
                <div className="text-[11px] text-[var(--faint)]">{t.app.updown.priceToBeat}</div>
                <div className="ltr-num text-[18px] font-bold tabular-nums">
                  {anchor == null ? "—" : fmtPrice(anchor)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--faint)]">{t.app.updown.averageSoFar}</div>
                <div className="flex items-baseline gap-2">
                  <span
                    className="ltr-num text-[18px] font-bold tabular-nums"
                    style={{ color: delta == null ? "var(--ink)" : winning ? "var(--up)" : "var(--down)" }}
                  >
                    {lastPoint == null ? "—" : fmtPrice(lastPoint.twap)}
                  </span>
                  {delta != null && (
                    <span
                      className="ltr-num text-[12px] font-semibold"
                      style={{ color: winning ? "var(--up)" : "var(--down)" }}
                    >
                      {winning ? "▲" : "▼"} {fmtPrice(Math.abs(delta))}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <PriceChart
              data={series}
              live
              accent={coin.color}
              decimals={coin.decimals}
              labels={{
                notStarted: t.app.updown.notStarted,
                loading: t.app.updown.loadingPrices,
                anchor: t.app.updown.anchorShort,
                average: t.app.updown.averageShort,
                price: t.app.updown.spot,
                open: t.app.updown.chartOpen,
                now: t.app.updown.chartNow,
                close: t.app.updown.chartClose,
              }}
            />

            {/*
              Under the cutoff the sides stop being buttons entirely rather than
              staying tappable and failing at the server. The next window is
              already open for business, so the screen says so instead of just
              refusing.
            */}
            {closing ? (
              <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--btn)] px-4 py-3 text-center">
                <p className="text-[13px] font-semibold text-[var(--down)]">
                  {t.app.updown.tooLate}
                </p>
                {next?.seconds_left != null && (
                  <p className="mt-1 text-[12px] text-[var(--mute)]">
                    {tf(t.app.updown.nextOpens, {
                      time: `${Math.max(0, Math.round((next.seconds_left - WINDOW_SECONDS) / 60))}`,
                    })}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4 flex gap-3">
                <SideButton
                  label={t.app.updown.up}
                  price={upPrice}
                  tone="var(--up)"
                  onClick={() => {
                    setSide("YES");
                    setError(null);
                    setSheetOpen(true);
                  }}
                />
                <SideButton
                  label={t.app.updown.down}
                  price={downPrice}
                  tone="var(--down)"
                  onClick={() => {
                    setSide("NO");
                    setError(null);
                    setSheetOpen(true);
                  }}
                />
              </div>
            )}
          </div>

          {settled.filter((r) => r.asset === active).length > 0 && (
            <section className="mt-6 px-4">
              <h2 className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
                {t.app.updown.recent}
              </h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {settled
                  .filter((r) => r.asset === active)
                  .map((r) => (
                    <li
                      key={r.market_id}
                      className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2"
                    >
                      <span className="ltr-num font-mono text-[12px] text-[var(--faint)]">
                        {now != null ? windowLabel(r, locale) : ""}
                      </span>
                      <span
                        className="text-[13px] font-bold"
                        style={{ color: r.won === "up" ? "var(--up)" : "var(--down)" }}
                      >
                        {r.won === "up" ? t.app.updown.up : t.app.updown.down}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </>
      )}

      {sheetOpen && live && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl border-t border-[var(--line)] bg-[var(--paper)] p-4 pb-8"
          role="dialog"
          aria-label={t.app.bet.sheetLabel}
        >
          <div className="flex items-center justify-between">
            <span
              className="rounded-full px-3 py-1 text-[13px] font-bold"
              style={{
                background: side === "YES" ? "var(--up)" : "var(--down)",
                color: "var(--card)",
              }}
            >
              {side === "YES" ? t.app.updown.up : t.app.updown.down}{" "}
              <span className="ltr-num">{price == null ? "—" : cents(price)}</span>
            </span>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="min-h-[40px] px-2 font-mono text-[12px] text-[var(--mute)]"
            >
              {t.app.detail.back}
            </button>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
              {t.app.bet.stake}
            </span>
            <span className="ltr-num font-mono text-[26px] font-semibold">{usd(stake)}</span>
          </div>

          <div className="mt-3 flex gap-2">
            {STAKE_CHIPS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={stake === v}
                onClick={() => setStake(v)}
                className={`min-h-[44px] flex-1 rounded-xl font-mono text-[14px] font-semibold transition-colors ${
                  stake === v
                    ? "bg-[var(--ink)] text-[var(--on-ink)]"
                    : "border border-[var(--line)] bg-[var(--btn)] text-[var(--mute)]"
                }`}
              >
                ${v}
              </button>
            ))}
          </div>

          <label className="mt-3 block">
            <span className="sr-only">{t.app.bet.customStakeLabel}</span>
            <input
              type="number"
              min={1}
              step={1}
              value={stake}
              onChange={(e) => {
                const n = Number(e.target.value);
                setStake(Number.isFinite(n) && n > 0 ? n : 1);
              }}
              className="min-h-[44px] w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 font-mono text-[15px] text-[var(--ink)]"
              placeholder={t.app.bet.customStakePlaceholder}
            />
          </label>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-[var(--btn)] px-4 py-3">
            <span className="text-[13px] text-[var(--mute)]">{t.app.bet.payoutIfCorrect}</span>
            <span className="ltr-num font-mono text-[17px] font-bold text-[var(--up)]">
              {usd(payout)}
            </span>
          </div>

          <p className="mt-2 flex justify-between font-mono text-[11px] text-[var(--faint)]">
            <span>
              <span className="ltr-num">{shares.toFixed(1)}</span> {t.app.bet.shares} {t.app.bet.at}{" "}
              <span className="ltr-num">{price == null ? "—" : cents(price)}</span>
            </span>
            {balance != null && (
              <span>
                {t.app.bet.balance} <span className="ltr-num">{usd(balance)}</span>
              </span>
            )}
          </p>

          {/*
            The clock keeps running while the sheet is open, so the guard is
            re-checked here rather than only at the moment the sheet opened.
          */}
          {closing && (
            <p className="mt-3 text-[13px] text-[var(--down)]">{t.app.updown.tooLate}</p>
          )}
          {insufficient && (
            <p className="mt-3 text-[13px] text-[var(--down)]">{t.app.bet.insufficient}</p>
          )}
          {error && (
            <p className="mt-3 rounded-lg bg-[color-mix(in_srgb,var(--down)_12%,transparent)] px-3 py-2 text-[13px] text-[var(--down)]">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={submitting || insufficient || !tradable}
            onClick={place}
            className="mt-4 min-h-[52px] w-full rounded-2xl bg-[var(--ink)] text-[16px] font-bold text-[var(--on-ink)] disabled:opacity-50"
          >
            {submitting ? (
              t.app.bet.placing
            ) : (
              <>
                {tf(t.app.bet.place, {
                  side: side === "YES" ? t.app.updown.up : t.app.updown.down,
                })}{" "}
                · <span className="ltr-num">{usd(stake)}</span>
              </>
            )}
          </button>
          <p className="mt-2 text-center font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
            {t.app.bet.signedOnChain}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * "12:30–12:45" in the reader's own locale.
 *
 * Farsi is pinned to Tehran for the same reason the public board is: a fixed
 * zone means one published schedule everybody reads the same way, and a reader
 * comparing the app against a channel post sees the same clock.
 */
function windowLabel(
  w: { window_start: string | null; window_end: string | null },
  locale: string,
): string {
  if (!w.window_start || !w.window_end) return "";
  const f = new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: locale === "fa" ? "Asia/Tehran" : undefined,
  });
  return `${f.format(new Date(w.window_start))}–${f.format(new Date(w.window_end))}`;
}

function SideButton({
  label,
  price,
  tone,
  onClick,
}: {
  label: string;
  price: number | null;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={price == null}
      className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] text-[16px] font-bold disabled:opacity-50"
      style={{ borderColor: tone, background: "var(--card)", color: tone }}
    >
      {label} <span className="ltr-num tabular-nums">{price == null ? "—" : cents(price)}</span>
    </button>
  );
}
