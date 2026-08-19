"use client";

import { useMemo, useState } from "react";
import type { SettledUpDownWindow, UpDownWindow } from "@/lib/api";
import type { PriceSeries } from "./PriceChart";

/**
 * The shared Up/Down desk.
 *
 * Two surfaces render this instrument: the public /updown page, which is a shop
 * window, and the mini-app tab, where it can actually be traded. They differ
 * only in what sits in the action slot — a payout calculator plus a Telegram CTA
 * on one, a bet slip on the other — and in width.
 *
 * Everything else lives here rather than being written twice: which window is
 * running, how the timeline is built, what the countdown says, how a coin is
 * badged. Two copies of that logic would drift, and the first thing to drift
 * would be which window counts as live — which is the one piece of it that can
 * cost somebody money.
 */

export type Coin = { glyph: string; color: string; decimals: number; name: string };

/**
 * Coin identity. The colours are each chain's own brand colour rather than
 * anything from our palette, and they are the one thing here that does not use a
 * theme token — a coin is the same colour in day and night, and readers
 * recognise the mark faster than the ticker.
 */
export const COINS: Record<string, Coin> = {
  BTC: { glyph: "₿", color: "#f7931a", decimals: 2, name: "Bitcoin" },
  ETH: { glyph: "Ξ", color: "#627eea", decimals: 2, name: "Ethereum" },
  SOL: { glyph: "◎", color: "#9945ff", decimals: 2, name: "Solana" },
};

const FALLBACK_COIN: Coin = { glyph: "◆", color: "var(--accent)", decimals: 2, name: "" };

/** Display order, so the coin list does not reshuffle as the API reorders. */
const COIN_ORDER = ["BTC", "ETH", "SOL"];

/** Window length. Only 15-minute windows exist. */
export const WINDOW_SECONDS = 900;

/** How many resolved and upcoming windows flank the live one in the timeline. */
const PAST_SLOTS = 2;
const FUTURE_SLOTS = 2;

/**
 * Seconds before close at which the RUNNING window stops being offered.
 *
 * Deliberately short. It exists to stop an order being submitted so late that
 * the window closes while it is in flight — a FAK that lands after the bell is
 * a failed bet, not a protected one — and for nothing else. It is NOT a view
 * about whether a converged price is a sensible trade: the price is on screen,
 * and buying the near-certain side for a few percent is a real strategy that
 * Polymarket itself allows right up to the close.
 *
 * This was 120s, mirroring the bot's LISTING filter. That was wrong here. The
 * bot's guard protects a multi-step chat flow that can outlive the window; the
 * slip in the app is two taps, and a two-minute dead zone on a fifteen-minute
 * market removes an eighth of its tradeable life for no benefit.
 */
export const CUTOFF_S = 30;

/** A position in the selected coin's timeline. */
export type Slot =
  | { kind: "past"; offset: number; row: SettledUpDownWindow }
  | { kind: "live"; offset: 0; row: UpDownWindow }
  | { kind: "future"; offset: number; row: UpDownWindow };

export function coinFor(asset: string | null): Coin {
  return (asset && COINS[asset]) || FALLBACK_COIN;
}

/**
 * Which timezone a brand renders window times in.
 *
 * PolyBaaz is pinned to Tehran rather than following the browser. Its audience
 * is Iranian, and a fixed zone means one published schedule everybody reads the
 * same way — a reader comparing the app against a channel post sees the same
 * clock. Being fixed also lets these labels render on the SERVER, which removes
 * the hydration gap entirely. Oddzy stays on the viewer's own zone: its audience
 * is global, so there is no single correct clock to pin it to.
 */
export function zoneFor(locale: string): string | undefined {
  return locale === "fa" ? "Asia/Tehran" : undefined;
}

export function makeTimeFormatter(locale: string) {
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: zoneFor(locale),
  });
}

/**
 * Everything the desk needs to know, derived from one board response.
 *
 * `sel` is an offset relative to the live window rather than an index, so it
 * survives a rollover: when the running window closes and the next opens, a
 * reader looking at "two windows ago" is still looking at two windows ago.
 */
export function useDeskModel({
  windows,
  settled,
  now,
}: {
  windows: UpDownWindow[];
  settled: SettledUpDownWindow[];
  /** Wall clock, null before mount. */
  now: number | null;
}) {
  const [asset, setAsset] = useState<string | null>(null);
  const [sel, setSel] = useState(0);

  const assets = useMemo(() => {
    const seen = new Set(windows.map((w) => w.asset));
    for (const r of settled) seen.add(r.asset);
    return [...seen].sort((a, b) => {
      const ia = COIN_ORDER.indexOf(a);
      const ib = COIN_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [windows, settled]);

  const active = asset && assets.includes(asset) ? asset : assets[0] ?? null;

  const slots = useMemo<Slot[]>(() => {
    if (!active) return [];
    const startOf = (s: string | null) => (s ? new Date(s).getTime() : 0);

    const past = settled
      .filter((r) => r.asset === active && r.window_start)
      .sort((a, b) => startOf(b.window_start) - startOf(a.window_start))
      .slice(0, PAST_SLOTS)
      .reverse();

    /**
     * Live-vs-scheduled is decided by `seconds_left`, which the API computes
     * against ITS clock, rather than by comparing window_start to ours. That
     * matters on the server render, where there is no viewer clock at all, and
     * on a device whose clock is wrong — a phone running a few minutes fast
     * would otherwise classify the running window as over and blank the board.
     */
    const open = windows
      .filter((w) => w.asset === active && w.window_start && w.window_end)
      .sort((a, b) => startOf(a.window_start) - startOf(b.window_start));

    const liveRow = open.find(
      (w) => w.seconds_left != null && w.seconds_left > 0 && w.seconds_left <= WINDOW_SECONDS,
    );
    const future = open
      .filter((w) => w.seconds_left != null && w.seconds_left > WINDOW_SECONDS)
      .slice(0, FUTURE_SLOTS);

    const out: Slot[] = [];
    past.forEach((row, i) => out.push({ kind: "past", offset: i - past.length, row }));
    if (liveRow) out.push({ kind: "live", offset: 0, row: liveRow });
    future.forEach((row, i) => out.push({ kind: "future", offset: i + 1, row }));
    return out;
  }, [active, windows, settled]);

  // Clamp rather than reset: after a rollover the offset the reader chose may no
  // longer exist, and snapping to the nearest keeps their place.
  const current = useMemo(() => {
    if (slots.length === 0) return null;
    return (
      slots.find((s) => s.offset === sel) ??
      slots.reduce((best, s) => (Math.abs(s.offset - sel) < Math.abs(best.offset - sel) ? s : best))
    );
  }, [slots, sel]);

  /** Seconds to the selected window's deadline: its close, or its open if scheduled. */
  const secondsLeft = useMemo(() => {
    if (!current || current.kind === "past") return null;
    const target = current.kind === "future" ? current.row.window_start : current.row.window_end;
    const ms = target ? new Date(target).getTime() : null;
    if (now != null && ms != null) return Math.max(0, Math.floor((ms - now) / 1000));
    const s = current.row.seconds_left;
    if (s == null) return null;
    // seconds_left counts to CLOSE; a scheduled window opens one length earlier.
    return Math.max(0, current.kind === "future" ? s - WINDOW_SECONDS : s);
  }, [current, now]);

  return {
    assets,
    active,
    setAsset,
    sel,
    setSel,
    slots,
    current,
    secondsLeft,
    coin: coinFor(active),
  };
}

/** mm:ss, or null when there is no clock to read yet. */
export function clockText(seconds: number | null): string {
  if (seconds == null) return "—";
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The price rail: what the average has to beat, and where the price is now.
 *
 * `spot` is the headline because that is what the reference design shows and
 * what a reader watching a coin expects to see. The running AVERAGE is what
 * actually settles these markets, so it is carried underneath as a figure — it
 * cannot be dropped without the page misrepresenting the product, but it does
 * not need to be a second line on the chart to do its job.
 */
export function PriceRail({
  series,
  coin,
  labels,
  compact = false,
}: {
  series: PriceSeries | null;
  coin: Coin;
  labels: { priceToBeat: string; current: string; average: string };
  compact?: boolean;
}) {
  const pts = series?.points ?? [];
  const last = pts[pts.length - 1] ?? null;
  const anchor = series?.anchor ?? null;
  const fmt = (v: number) =>
    `$${v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v.toFixed(coin.decimals)}`;

  const delta = last && anchor != null ? last.p - anchor : null;
  const rising = delta != null && delta >= 0;
  const tone = rising ? "var(--up)" : "var(--down)";
  const big = compact ? "text-[18px]" : "text-[24px]";

  return (
    <div className={`${compact ? "mt-4 gap-x-6" : "mt-5 gap-x-9"} flex flex-wrap gap-y-3`}>
      <div>
        <div className="text-[12px] text-[var(--faint)]">{labels.priceToBeat}</div>
        <div className={`ltr-num ${big} font-bold tabular-nums`}>
          {anchor == null ? "—" : fmt(anchor)}
        </div>
      </div>
      <div>
        <div className="text-[12px] text-[var(--faint)]">{labels.current}</div>
        <div className="flex items-baseline gap-2.5">
          <span
            className={`ltr-num ${big} font-bold tabular-nums`}
            style={{ color: delta == null ? "var(--ink)" : tone }}
          >
            {last == null ? "—" : fmt(last.p)}
          </span>
          {delta != null && (
            <span className="ltr-num text-[13px] font-semibold" style={{ color: tone }}>
              {rising ? "▲" : "▼"} {fmt(Math.abs(delta))}
            </span>
          )}
        </div>
        {last != null && (
          <div className="mt-0.5 text-[11.5px] text-[var(--faint)]">
            {labels.average} <span className="ltr-num">{fmt(last.twap)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** The countdown, or the verdict for a window that has already resolved. */
export function Countdown({
  slot,
  seconds,
  labels,
  compact = false,
}: {
  slot: Slot;
  seconds: number | null;
  labels: {
    closesIn: string;
    opensIn: string;
    closing: string;
    finalResult: string;
    resolvedUp: string;
    resolvedDown: string;
  };
  compact?: boolean;
}) {
  if (slot.kind === "past") {
    const up = slot.row.won === "up";
    return (
      <div className="text-center">
        <div
          className={`${compact ? "text-[20px]" : "text-[24px]"} font-bold`}
          style={{ color: up ? "var(--up)" : "var(--down)" }}
        >
          {up ? labels.resolvedUp : labels.resolvedDown}
        </div>
        <div className="text-[12px] text-[var(--faint)]">{labels.finalResult}</div>
      </div>
    );
  }
  const closing = slot.kind === "live" && seconds != null && seconds < CUTOFF_S;
  return (
    <div className="text-center">
      <div
        className={`ltr-num ${compact ? "text-[26px]" : "text-[32px]"} font-bold tabular-nums`}
        style={{
          color:
            slot.kind === "future" ? "var(--accent)" : closing ? "var(--down)" : "var(--ink)",
        }}
      >
        {clockText(seconds)}
      </div>
      <div className="text-[12px] text-[var(--faint)]">
        {slot.kind === "future" ? labels.opensIn : closing ? labels.closing : labels.closesIn}
      </div>
    </div>
  );
}

/** Where the selected window sits among its neighbours in time. */
export function Timeline({
  slots,
  current,
  onSelect,
  showTimes,
  fmtTime,
  liveLabel,
}: {
  slots: Slot[];
  current: Slot;
  onSelect: (offset: number) => void;
  showTimes: boolean;
  fmtTime: (iso: string | null) => string;
  liveLabel: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {slots.map((s) => {
        const on = s.offset === current.offset;
        const won = s.kind === "past" ? s.row.won === "up" : null;
        return (
          <button
            key={`${s.kind}-${s.offset}`}
            type="button"
            onClick={() => onSelect(s.offset)}
            aria-current={on}
            className={[
              "inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] transition",
              on ? "ring-2 ring-[var(--accent)]" : "",
              s.kind === "past"
                ? "bg-[var(--btn)] font-medium text-[var(--mute)]"
                : s.kind === "live"
                  ? "bg-[var(--ink)] font-semibold text-[var(--on-ink)]"
                  : "border border-dashed border-[var(--line)] font-medium text-[var(--faint)]",
            ].join(" ")}
          >
            {s.kind !== "future" && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  background:
                    s.kind === "live" ? "var(--down)" : won ? "var(--up)" : "var(--down)",
                }}
                aria-hidden
              />
            )}
            {/* Until the viewer's zone is known these cannot be formatted, and an
                empty pill reads as a broken control rather than a pending one. */}
            <span className="ltr-num tabular-nums">
              {showTimes ? fmtTime(s.row.window_start) : "··:··"}
            </span>
            {s.kind === "live" && <span>— {liveLabel}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** The other coins, with each one's current lean. */
export function OtherCoins({
  assets,
  active,
  windows,
  onSelect,
  labels,
}: {
  assets: string[];
  active: string;
  windows: UpDownWindow[];
  onSelect: (asset: string) => void;
  labels: { heading: string; up: string; down: string; interval: string };
}) {
  const others = assets.filter((a) => a !== active);
  if (others.length === 0) return null;
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-2">
      <h3 className="px-3 pt-2 pb-1.5 text-[13px] font-semibold text-[var(--mute)]">
        {labels.heading}
      </h3>
      <div className="flex flex-col">
        {others.map((a) => {
          const c = coinFor(a);
          const w = windows.find((x) => x.asset === a && x.up_price != null);
          const pu = w?.up_price ?? null;
          const isUp = pu != null && pu >= 0.5;
          const pct =
            pu == null ? "—" : `${Math.round((isUp ? pu : 1 - pu) * 100)}% ${isUp ? labels.up : labels.down}`;
          return (
            <button
              key={a}
              type="button"
              onClick={() => onSelect(a)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition hover:bg-[var(--btn)]"
            >
              <CoinBadge coin={c} size={38} />
              <span className="flex-1">
                <span className="block text-[14.5px] font-semibold">{c.name || a}</span>
                <span className="block text-[12px] text-[var(--faint)]">
                  {a} · {labels.interval}
                </span>
              </span>
              <span
                className="ltr-num whitespace-nowrap rounded-full bg-[var(--paper)] px-2.5 py-1 text-[13px] font-bold"
                style={{ color: pu == null ? "var(--faint)" : isUp ? "var(--up)" : "var(--down)" }}
              >
                {pct}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function CoinBadge({ coin, size }: { coin: Coin; size: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl font-bold text-white"
      style={{
        background: coin.color,
        width: size,
        height: size,
        fontSize: Math.round(size * 0.48),
        borderRadius: Math.round(size * 0.27),
      }}
      aria-hidden
    >
      {coin.glyph}
    </span>
  );
}

/** The two sides, priced. */
export function SideButtons({
  upPrice,
  downPrice,
  activeSide,
  disabled,
  onPick,
  labels,
}: {
  upPrice: number | null;
  downPrice: number | null;
  /** "up" | "down" | null — null leaves neither filled. */
  activeSide: "up" | "down" | null;
  disabled: boolean;
  onPick: (side: "up" | "down") => void;
  labels: { up: string; down: string };
}) {
  const cents = (p: number | null) => (p == null ? "—" : `${Math.round(p * 100)}¢`);
  const btn = (side: "up" | "down", tone: string, label: string, price: number | null) => {
    const on = activeSide === side;
    return (
      <button
        type="button"
        onClick={() => onPick(side)}
        disabled={disabled}
        aria-pressed={on}
        className="flex flex-1 items-center justify-center gap-2.5 rounded-xl border-[1.5px] px-2.5 py-3.5 text-[17px] font-bold transition"
        style={{
          borderColor: on ? tone : "var(--line)",
          background: on ? tone : "var(--paper)",
          color: on ? "var(--card)" : tone,
          opacity: disabled && !on ? 0.55 : 1,
          cursor: disabled ? "default" : "pointer",
        }}
      >
        {label} <span className="ltr-num tabular-nums">{cents(price)}</span>
      </button>
    );
  };
  return (
    <div className="mt-4 flex gap-3">
      {btn("up", "var(--up)", labels.up, upPrice)}
      {btn("down", "var(--down)", labels.down, downPrice)}
    </div>
  );
}
