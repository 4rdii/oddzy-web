"use client";

import { useEffect, useMemo, useState } from "react";
import type { Market, SettledUpDownWindow, UpDownWindow } from "@/lib/api";
import { cents, payoutFor, usd } from "@/lib/format";
import { authedPost, ApiCallError } from "@/lib/client-api";
import { useTelegram } from "@/lib/telegram";
import { useLocale } from "./LocaleProvider";
import { PriceChart, useWindowPrices } from "../updown/PriceChart";
import {
  CUTOFF_S,
  CoinBadge,
  Countdown,
  OtherCoins,
  PriceRail,
  SideButtons,
  Timeline,
  makeTimeFormatter,
  useDeskModel,
  zoneFor,
} from "../updown/desk";
import type { PlacedBet } from "./MarketDetail";

/**
 * Up or Down, tradeable.
 *
 * The same desk the public /updown page renders — coin badge, countdown, price
 * rail, chart, timeline, sibling coins — composed from ../updown/desk so the two
 * surfaces cannot drift. The difference is the action slot: instead of a payout
 * calculator and a Telegram CTA, picking a side opens a bet slip.
 *
 * It reuses the PUBLIC /api/updown feed, because window prices are public data
 * and the proxy already exists. Only placement is authenticated, through the
 * same /webapp/v1/bet the chat flow and MarketDetail use — so the lock, the
 * server-side re-quote, the slippage cap, the picks row and rev-share accrual
 * cannot drift between surfaces. There is no up/down-specific money path.
 */

const POLL_MS = 5000;

/** Stake chips. Lower than MarketDetail's: these are fifteen-minute punts. */
const STAKE_CHIPS = [5, 10, 25, 50];

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
  const [side, setSide] = useState<"up" | "down">("up");
  const [stake, setStake] = useState(10);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

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

  const { assets, active, setAsset, setSel, slots, current, secondsLeft, coin } = useDeskModel({
    windows,
    settled,
    now,
  });

  const series = useWindowPrices(
    current?.row.slug ?? "",
    current?.kind === "live",
    current == null || current.kind === "future",
  );

  const fmtTime = useMemo(() => {
    const f = makeTimeFormatter(locale);
    return (iso: string | null) => (iso ? f.format(new Date(iso)) : "");
  }, [locale]);
  // Farsi is pinned to Tehran, so its labels are correct before mount; English
  // follows the viewer's zone and has to wait for one.
  const showTimes = Boolean(zoneFor(locale)) || now != null;

  const u = t.app.updown;

  if (!loaded) {
    return <p className="px-4 py-10 text-center text-[14px] text-[var(--mute)]">{u.loading}</p>;
  }
  if (!active || !current) {
    return <p className="px-4 py-10 text-center text-[14px] text-[var(--mute)]">{u.none}</p>;
  }

  const settledView = current.kind === "past";
  const futureView = current.kind === "future";
  const resolvedUp = settledView ? current.row.won === "up" : null;
  const upPrice = current.kind === "live" ? current.row.up_price : null;
  const downPrice = current.kind === "live" ? current.row.down_price : null;

  /**
   * Unknown time counts as closing, not as open.
   *
   * The failure directions are not symmetric: treating an unknown deadline as
   * tradable can sell someone a window that has already decided, while treating
   * it as closed costs them one refresh.
   */
  const closing = secondsLeft == null || secondsLeft < CUTOFF_S;
  const price = side === "up" ? upPrice : downPrice;
  const tradable = current.kind === "live" && !closing && price != null && price > 0;
  const shares = price != null && price > 0 ? stake / price : 0;
  const payout = price != null && price > 0 ? payoutFor(stake, price) : 0;
  const insufficient = balance != null && stake > balance;

  const nextOpen = slots.find((s) => s.kind === "future");

  async function place() {
    if (!current || current.kind !== "live" || !tradable) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await authedPost<{
        filledShares: number;
        costUsd: number;
        avgPrice: number;
        orderId: string | null;
        txHash: string | null;
      }>("/webapp/v1/bet", {
        marketId: current.row.market_id,
        side: side === "up" ? "YES" : "NO",
        sizeUsdc: stake,
      });

      /*
       * The receipt wants a Market and a window is not one. Rather than widen
       * PlacedBet — which would push an optional shape through Receipt,
       * Positions and everything else that consumes it — the window is dressed
       * as the minimal Market the receipt actually reads: a title and a close
       * time. The title is composed here because the API deliberately does not
       * return one; Polymarket titles these in ET, which is meaningless to a
       * Tehran reader.
       */
      const label = `${fmtTime(current.row.window_start)}–${fmtTime(current.row.window_end)}`;
      onPlaced({
        market: {
          title: `${coin.name || active} ${side === "up" ? u.up : u.down} · ${label}`,
          close_time: current.row.window_end,
        } as unknown as Market,
        side: side === "up" ? "YES" : "NO",
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

  return (
    <div className="pb-28">
      <div className="px-4 pt-4">
        <h1 className="text-[20px] font-bold tracking-[-0.02em]">{u.title}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--mute)]">{u.rule}</p>
      </div>

      <div className="mx-4 mt-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
        <div className="flex items-start gap-3">
          <CoinBadge coin={coin} size={44} />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold">
              {coin.name || active} · {u.interval}
              {settledView && ` · ${u.resolvedTag}`}
              {futureView && ` · ${u.nextTag}`}
            </div>
            <div className="mt-0.5 text-[12px] text-[var(--faint)]">
              {showTimes && (
                <span className="ltr-num">
                  {fmtTime(current.row.window_start)}–{fmtTime(current.row.window_end)}
                </span>
              )}
              {current.row.volume != null && (
                <>
                  {showTimes && " · "}
                  <span className="ltr-num">
                    ${Math.round(current.row.volume).toLocaleString("en-US")}
                  </span>{" "}
                  {u.volume}
                </>
              )}
            </div>
          </div>
          <Countdown
            slot={current}
            seconds={secondsLeft}
            compact
            labels={{
              closesIn: u.closesIn,
              opensIn: u.opensIn,
              closing: u.closing,
              finalResult: u.finalResult,
              resolvedUp: u.resolvedUp,
              resolvedDown: u.resolvedDown,
            }}
          />
        </div>

        {!futureView && (
          <PriceRail
            series={series}
            coin={coin}
            compact
            labels={{ priceToBeat: u.priceToBeat, current: u.currentPrice, average: u.averageShort }}
          />
        )}

        <PriceChart
          data={series}
          live={current.kind === "live"}
          pending={futureView}
          accent={coin.color}
          decimals={coin.decimals}
          height={170}
          labels={{
            notStarted: u.notStarted,
            loading: u.loadingPrices,
            anchor: u.priceToBeat,
            open: u.chartOpen,
            now: u.chartNow,
            close: u.chartClose,
          }}
        />

        <Timeline
          slots={slots}
          current={current}
          onSelect={setSel}
          showTimes={showTimes}
          fmtTime={fmtTime}
          liveLabel={u.live}
        />

        {/*
          Under the cutoff the sides stop being buttons entirely rather than
          staying tappable and failing at the server. The next window is already
          open for business, so the screen says so instead of just refusing.
        */}
        {current.kind === "live" && closing ? (
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--btn)] px-4 py-3 text-center">
            <p className="text-[13px] font-semibold text-[var(--down)]">{u.tooLate}</p>
            {nextOpen && (
              <button
                type="button"
                onClick={() => setSel(nextOpen.offset)}
                className="mt-1 text-[12px] font-semibold text-[var(--accent)] underline"
              >
                {u.seeNext}
              </button>
            )}
          </div>
        ) : settledView ? (
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--btn)] px-4 py-3 text-center text-[13px] font-semibold">
            <span style={{ color: resolvedUp ? "var(--up)" : "var(--down)" }}>
              {resolvedUp ? u.upWon : u.downWon}
            </span>
          </div>
        ) : futureView ? (
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--btn)] px-4 py-3 text-center text-[13px] text-[var(--mute)]">
            {u.notStarted}
          </div>
        ) : (
          <SideButtons
            upPrice={upPrice}
            downPrice={downPrice}
            activeSide={sheetOpen ? side : null}
            disabled={false}
            onPick={(s) => {
              setSide(s);
              setError(null);
              setSheetOpen(true);
            }}
            labels={{ up: u.up, down: u.down }}
          />
        )}
      </div>

      <div className="mt-5 px-4">
        <OtherCoins
          assets={assets}
          active={active}
          windows={windows}
          onSelect={(a) => {
            setAsset(a);
            setSel(0);
            setSheetOpen(false);
          }}
          labels={{ heading: u.otherMarkets, up: u.up, down: u.down, interval: u.interval }}
        />
      </div>

      {sheetOpen && current.kind === "live" && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl border-t border-[var(--line)] bg-[var(--paper)] p-4 pb-8"
          role="dialog"
          aria-label={t.app.bet.sheetLabel}
        >
          <div className="flex items-center justify-between">
            <span
              className="rounded-full px-3 py-1 text-[13px] font-bold"
              style={{
                background: side === "up" ? "var(--up)" : "var(--down)",
                color: "var(--card)",
              }}
            >
              {side === "up" ? u.up : u.down}{" "}
              <span className="ltr-num">{price == null ? "—" : cents(price)}</span>
            </span>
            <span className="ltr-num font-mono text-[12px] text-[var(--faint)]">
              {clock(secondsLeft)}
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

          {/* The clock keeps running while the sheet is open, so the guard is
              re-checked here rather than only when the sheet was opened. */}
          {closing && <p className="mt-3 text-[13px] text-[var(--down)]">{u.tooLate}</p>}
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
                {tf(t.app.bet.place, { side: side === "up" ? u.up : u.down })} ·{" "}
                <span className="ltr-num">{usd(stake)}</span>
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

function clock(seconds: number | null): string {
  if (seconds == null) return "—";
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
