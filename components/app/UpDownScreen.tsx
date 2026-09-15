"use client";

import { useEffect, useMemo, useState } from "react";
import type { Market, SettledUpDownWindow, UpDownWindow } from "@/lib/api";
import { cents, payoutFor, usd } from "@/lib/format";
import { authedGet, authedPost, ApiCallError } from "@/lib/client-api";
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
import { ReduceSheet, type Position } from "./AccountScreens";

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

/**
 * Positions refresh. Slower than the board: /webapp/v1/positions goes to the
 * data API and the CLOB for every holding, shares a 60/minute budget with the
 * Positions tab, and — like every signed-in call — runs through a Vercel
 * function, which is the Fluid CPU budget. 30s plus the post-bet refresh below
 * keeps a new position prompt without paying for a poll nobody is waiting on.
 */
const POSITIONS_POLL_MS = 30_000;

/**
 * While the bet sheet is open, re-read the live quote this often.
 *
 * The board's price is up to a poll behind; the sheet is where a number becomes
 * an order, so it reads the book directly (GET /webapp/v1/quote — the same
 * source placement checks against). Only while the sheet is open, so the cost
 * is a handful of requests per bet, not per viewer-minute.
 */
const QUOTE_REFRESH_MS = 4_000;

/**
 * The data API lags a fill by 10-30s, so the refresh right after a bet usually
 * comes back without it. One follow-up at this delay is what makes a new
 * position appear promptly instead of on whichever poll happens to land.
 */
const POST_BET_REFRESH_MS = 12_000;

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
  /**
   * Everything the viewer holds, or null before the first read / when they
   * can't be read (signed out, no wallet). Null hides the pane rather than
   * showing an error: positions are a convenience on this screen, and a sign-in
   * prompt wedged between the chart and the other coins would be louder than the
   * trade it sits beside.
   */
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [posNonce, setPosNonce] = useState(0);
  const [manage, setManage] = useState<Position | null>(null);
  /**
   * The live price for the side in the open sheet, from the book. Null until the
   * first read lands (the board's price stands in meanwhile), and cleared when
   * the sheet closes or the side changes so a quote never outlives its question.
   */
  const [quote, setQuote] = useState<number | null>(null);
  /** Set when the server refused a bet because the book moved; holds the new price. */
  const [movedTo, setMovedTo] = useState<number | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const load = () => {
      // A backgrounded tab has no one to show positions to, and every read spends
      // the shared per-user budget.
      if (typeof document !== "undefined" && document.hidden) return;
      authedGet<{ positions: Position[] }>("/webapp/v1/positions", ctrl.signal)
        .then((d) => setPositions(d.positions))
        .catch((e: unknown) => {
          if ((e as Error)?.name === "AbortError") return;
          // Rate-limited or a transient failure: keep what's on screen. Only a
          // hard "you can't have positions" clears it.
          if (e instanceof ApiCallError && (e.kind === "unauthenticated" || e.kind === "no_account")) {
            setPositions(null);
          }
        });
    };
    load();
    const id = setInterval(load, POSITIONS_POLL_MS);
    return () => {
      clearInterval(id);
      ctrl.abort();
    };
  }, [posNonce]);

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

  const sheetMarketId =
    sheetOpen && current && current.kind !== "past"
      ? (current.row as { market_id: string }).market_id
      : null;

  useEffect(() => {
    if (!sheetMarketId) return;
    const ctrl = new AbortController();
    const read = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      authedGet<{ price: number }>(
        `/webapp/v1/quote?marketId=${encodeURIComponent(sheetMarketId)}&side=${side === "up" ? "YES" : "NO"}`,
        ctrl.signal,
      )
        .then((d) => {
          if (typeof d.price === "number" && d.price > 0 && d.price < 1) setQuote(d.price);
        })
        .catch(() => {
          // Keep the last quote (or the board price). Placement re-checks the
          // live book regardless, so a missed read cannot cause a bad fill.
        });
    };
    read();
    const id = setInterval(read, QUOTE_REFRESH_MS);
    return () => {
      clearInterval(id);
      ctrl.abort();
    };
  }, [sheetMarketId, side]);

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

  /**
   * A scheduled window is tradeable, and that is not a special case — its book
   * is open on Polymarket before the window starts, it quotes (usually 51/49),
   * and it takes volume. Treating "hasn't opened yet" as "can't be bought" made
   * the app refuse a market that was visibly trading everywhere else. Only a
   * RESOLVED window has no side left to take.
   */
  const priced = settledView ? null : current.row;
  const upPrice = priced?.up_price ?? null;
  const downPrice = priced?.down_price ?? null;

  /**
   * The late-submission guard, and it applies to the running window only.
   *
   * For a scheduled window `secondsLeft` counts down to its OPEN, so reading it
   * as "about to close" would block precisely the window with the most life left
   * in it. Unknown time on a running window still counts as closing: treating an
   * unknown deadline as tradable can submit an order into a window that has
   * already gone, while treating it as closed costs one refresh.
   */
  const closing = current.kind === "live" && (secondsLeft == null || secondsLeft < CUTOFF_S);
  // In the sheet, the live quote wins over the board: it is newer, and it is the
  // number placement compares against. The board's price only fills the gap
  // until the first quote arrives.
  const price = (sheetOpen ? quote : null) ?? (side === "up" ? upPrice : downPrice);
  const tradable = !settledView && !closing && price != null && price > 0;
  const shares = price != null && price > 0 ? stake / price : 0;
  const payout = price != null && price > 0 ? payoutFor(stake, price) : 0;
  const insufficient = balance != null && stake > balance;

  const nextOpen = slots.find((s) => s.kind === "future");

  /*
   * Holdings in the window ON SCREEN, matched by slug — the data API reports the
   * same btc-updown-15m-<start> slug the board uses. Scoped to the viewed window
   * rather than the whole coin because that is the question this spot answers:
   * "what do I have riding on the thing I'm looking at?"
   *
   * A resolved loser is dropped with the same conservative test the Positions tab
   * uses (worthless AND at a loss): losing shares never leave the wallet, and a
   * $0 row offering a Close button that can only fail is noise. A resolved
   * WINNER stays, with Claim instead of Close.
   */
  const windowPositions = (positions ?? []).filter(
    (p) =>
      p.slug === current.row.slug &&
      !(p.settled && !p.won && p.value < 0.01 && p.pnl < 0),
  );

  async function place() {
    if (!current || current.kind === "past" || !tradable) return;
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
        marketId: (current.row as { market_id: string }).market_id,
        side: side === "up" ? "YES" : "NO",
        sizeUsdc: stake,
        // The price on screen. The server checks the live book against THIS, so
        // a bet is only refused when the market really moved past what the user
        // agreed to — not because the server's own quote was stale.
        quotedPrice: price,
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
      setQuote(null);
      setMovedTo(null);
      setPosNonce((n) => n + 1);
      setTimeout(() => setPosNonce((n) => n + 1), POST_BET_REFRESH_MS);
    } catch (e) {
      const err = e as ApiCallError & { serverMessage?: string; serverCode?: string; serverFresh?: number };
      const server = err?.serverMessage;
      if (err?.serverCode === "price_moved" && err.serverFresh != null) {
        // Not an error the user has to recover from: adopt the live price so the
        // very next tap sends it as the quote, and say what happened.
        setQuote(err.serverFresh);
        setMovedTo(err.serverFresh);
        setError(null);
        return;
      }
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
        {closing ? (
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
        ) : (
          <SideButtons
            upPrice={upPrice}
            downPrice={downPrice}
            activeSide={sheetOpen ? side : null}
            disabled={false}
            onPick={(s) => {
              setSide(s);
              setError(null);
              setQuote(null);
              setMovedTo(null);
              setSheetOpen(true);
            }}
            labels={{ up: u.up, down: u.down }}
          />
        )}
      </div>

      {windowPositions.length > 0 && (
        <section className="mx-4 mt-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
          <h2 className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
            {u.yourPositions}
          </h2>
          <ul className="mt-2 divide-y divide-[var(--line)]">
            {windowPositions.map((p) => {
              const isUp = /^up$/i.test(p.side);
              const claimable = p.settled && p.won;
              return (
                <li key={`${p.marketId}-${p.side}`} className="flex items-center gap-3 py-2.5">
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold"
                    style={{
                      background: isUp ? "var(--up)" : "var(--down)",
                      color: "var(--card)",
                    }}
                  >
                    {isUp ? u.up : u.down}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 font-mono text-[13px]">
                      <span className="ltr-num font-semibold">{usd(p.value)}</span>
                      <span
                        className="ltr-num text-[12px]"
                        style={{ color: p.pnl >= 0 ? "var(--up)" : "var(--down)" }}
                      >
                        {p.pnl >= 0 ? "+" : "−"}
                        {usd(Math.abs(p.pnl))}
                      </span>
                    </div>
                    {/* One fact per line, each labelled. "avg 17¢ → 16¢" read as a
                        price move with no subject; buyers asked what the two
                        numbers were. */}
                    <div className="mt-0.5 font-mono text-[11px] text-[var(--faint)]">
                      <span className="ltr-num">{p.shares.toFixed(1)}</span> {t.app.positions.shares}
                    </div>
                    <div className="font-mono text-[11px] text-[var(--faint)]">
                      {u.avgBuy}: <span className="ltr-num">{cents(p.avgPrice)}</span>
                    </div>
                    <div className="font-mono text-[11px] text-[var(--faint)]">
                      {u.currentPrice}: <span className="ltr-num">{cents(p.curPrice)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setManage(p)}
                    className="min-h-[40px] shrink-0 rounded-xl border border-[var(--line)] bg-[var(--btn)] px-4 text-[13px] font-semibold"
                    style={{ color: claimable ? "var(--up)" : "var(--ink)" }}
                  >
                    {claimable ? u.claim : u.close}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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

      {sheetOpen && !settledView && (
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
              onClick={() => {
                setSheetOpen(false);
                setQuote(null);
                setMovedTo(null);
              }}
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
          {movedTo != null && (
            <p className="mt-3 rounded-lg bg-[var(--btn)] px-3 py-2 text-[13px] text-[var(--ink)]">
              {tf(u.priceMoved, { price: cents(movedTo) })}
            </p>
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

      {manage && (
        <ReduceSheet
          position={manage}
          defaultPct={100}
          onClose={() => setManage(null)}
          onDone={() => {
            setManage(null);
            // Same lag as a buy: the sold shares linger in the data API briefly.
            setPosNonce((n) => n + 1);
            setTimeout(() => setPosNonce((n) => n + 1), POST_BET_REFRESH_MS);
          }}
        />
      )}
    </div>
  );
}

function clock(seconds: number | null): string {
  if (seconds == null) return "—";
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
