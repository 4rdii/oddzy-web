"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UpDownWindow, SettledUpDownWindow } from "@/lib/api";
import { PriceChart } from "./PriceChart";

/**
 * Live board for 15-minute crypto up/down windows.
 *
 * Client-rendered and polled, which is unusual for this site — every other page
 * is a static server render because it exists for crawlers. This one is the
 * opposite: it is a live instrument. A window lives fifteen minutes, so a server
 * render is stale before it reaches the browser.
 *
 * THE CHART IS THE ODDS, NOT THE COIN PRICE, and that is a deliberate choice
 * rather than a shortcut. These markets resolve on the time-weighted AVERAGE
 * price across the window versus the price when it opened — not on where the
 * price finishes. A coin-price line would therefore invite exactly the wrong
 * arithmetic: a viewer watching spot return to its opening level would conclude
 * "Down", when an average that sat above the open all window resolves Up. The
 * odds line has no such gap. It is the market's own live estimate of the thing
 * being asked, so it cannot disagree with the question, and it needs no
 * disclaimer about which feed it came from.
 *
 * There is no historical seed. Stored price history is hourly, which is one
 * point per fifteen-minute window — useless. The series builds from the moment
 * you open the page, which for a countdown product reads as intended rather
 * than as missing data.
 */

const POLL_MS = 5000;

/** Points kept per window. 15 min at 5s = 180; a little headroom for drift. */
const MAX_POINTS = 200;

type Point = { t: number; up: number };

export type UpDownCopy = {
  heading: string;
  lead: string;
  rule: string;
  none: string;
  closesIn: string;
  up: string;
  down: string;
  volume: string;
  waiting: string;
  resolved: string;
  resolvedUp: string;
  resolvedDown: string;
  closing: string;
  notStarted: string;
  loadingPrices: string;
  anchor: string;
  average: string;
  price: string;
};

/** Upcoming windows shown per asset. Three, per the product decision. */
const MAX_PER_ASSET = 3;

/**
 * Which timezone a brand renders window times in.
 *
 * PolyBaaz is pinned to Tehran rather than following the browser. Its audience
 * is Iranian, every Farsi user in the database has a Tehran-or-adjacent zone,
 * and a fixed zone means one published schedule that everybody reads the same
 * way — a reader comparing the site against a screenshot or a channel post sees
 * the same clock. Being fixed also lets these labels render on the SERVER, which
 * removes the hydration gap entirely.
 *
 * Oddzy stays on the viewer's own zone: its audience is global, so there is no
 * single correct clock to pin it to.
 */
function zoneFor(locale: "en" | "fa"): string | undefined {
  return locale === "fa" ? "Asia/Tehran" : undefined;
}

export function UpDownBoard({
  initial,
  initialSettled,
  copy,
  locale,
}: {
  initial: UpDownWindow[];
  initialSettled: SettledUpDownWindow[];
  copy: UpDownCopy;
  locale: "en" | "fa";
}) {
  const [windows, setWindows] = useState<UpDownWindow[]>(initial);
  const [settled, setSettled] = useState<SettledUpDownWindow[]>(initialSettled);
  // Keyed by market_id so a series survives re-ordering, and dies with its
  // window rather than leaking into the next one.
  const series = useRef<Map<string, Point[]>>(new Map());
  const [, forceTick] = useState(0);
  /**
   * Time labels are rendered ONLY after mount.
   *
   * They are formatted in the viewer's timezone, and on the server that is UTC —
   * so a server-rendered label said "17:30–17:45" to a reader in Tehran whose
   * clock read 21:05. That does not just look untidy on a fifteen-minute market:
   * it makes the running window read as one from hours ago, which is why the
   * current window appeared to be missing entirely.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/updown", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        windows: UpDownWindow[];
        settled: SettledUpDownWindow[];
      };
      setWindows(data.windows ?? []);
      setSettled(data.settled ?? []);
    } catch {
      // Transient. Keep the last good board rather than blanking a live screen.
    }
  }, []);

  // Append to each window's series whenever new prices arrive.
  useEffect(() => {
    const now = Date.now();
    const live = new Set(windows.map((w) => w.market_id));
    for (const w of windows) {
      if (w.up_price == null) continue;
      const arr = series.current.get(w.market_id) ?? [];
      const last = arr[arr.length - 1];
      if (!last || last.up !== w.up_price) {
        arr.push({ t: now, up: w.up_price });
        if (arr.length > MAX_POINTS) arr.shift();
        series.current.set(w.market_id, arr);
      }
    }
    // Drop series for windows that have expired, or the map grows all day.
    for (const key of series.current.keys()) {
      if (!live.has(key)) series.current.delete(key);
    }
  }, [windows]);

  useEffect(() => {
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  // Second-resolution countdown, independent of the price poll: a clock that
  // only moved every 5s would visibly stutter.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Cap per asset rather than globally: a global cap would show three BTC
  // windows and nothing else, hiding two of the three coins entirely.
  const shown = useMemo(() => {
    const perAsset = new Map<string, number>();
    return windows.filter((w) => {
      const n = perAsset.get(w.asset) ?? 0;
      if (n >= MAX_PER_ASSET) return false;
      perAsset.set(w.asset, n + 1);
      return true;
    });
  }, [windows]);

  return (
    <>
      {shown.length === 0 ? (
        <p className="text-[15px] text-[var(--mute)]">{copy.none}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((w) => (
            <WindowCard
              key={w.market_id}
              w={w}
              points={series.current.get(w.market_id) ?? []}
              copy={copy}
              locale={locale}
              mounted={mounted}
            />
          ))}
        </ul>
      )}

      {settled.length > 0 && (
        <ResolvedStrip rows={settled} copy={copy} locale={locale} mounted={mounted} />
      )}
    </>
  );
}

/**
 * Recently resolved windows.
 *
 * The most persuasive thing on this page for someone who has not bet. Every
 * other element is a promise; this is the record. It is why the API returns
 * settled rows alongside live ones instead of making the page ask twice.
 */
function ResolvedStrip({
  rows,
  copy,
  locale,
  mounted,
}: {
  rows: SettledUpDownWindow[];
  copy: UpDownCopy;
  locale: "en" | "fa";
  mounted: boolean;
}) {
  const tz = zoneFor(locale);
  const fmt = new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  });
  return (
    <section className="mt-8">
      <h2 className="font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]">
        {copy.resolved}
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((r) => {
          const up = r.won === "up";
          return (
            <li
              key={r.market_id}
              className="flex items-center justify-between gap-4 rounded-xl border border-[var(--line)] px-4 py-2.5"
            >
              <span className="text-[14px] font-semibold">{r.asset}</span>
              <span className="font-mono text-[12px] text-[var(--faint)]">
                <span className="ltr-num">
                  {(tz || mounted) && r.window_start && r.window_end
                    ? `${fmt.format(new Date(r.window_start))}–${fmt.format(new Date(r.window_end))}`
                    : ""}
                </span>
              </span>
              <span
                className="text-[13px] font-bold"
                style={{ color: up ? "var(--up)" : "var(--down)" }}
              >
                {up ? copy.resolvedUp : copy.resolvedDown}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function WindowCard({
  w,
  points,
  copy,
  locale,
  mounted,
}: {
  w: UpDownWindow;
  points: Point[];
  copy: UpDownCopy;
  locale: "en" | "fa";
  mounted: boolean;
}) {
  const endMs = w.window_end ? new Date(w.window_end).getTime() : null;
  const left = endMs == null ? null : Math.max(0, Math.floor((endMs - Date.now()) / 1000));

  const up = w.up_price;
  const down = w.down_price;
  const cents = (p: number | null) =>
    p == null ? "—" : `${Math.round(p * 100)}¢`;

  /**
   * With a pinned zone (fa) this renders identically on server and client, so it
   * is shown immediately. With the viewer's own zone (en) the server would emit
   * UTC and hydration would rewrite it, so it waits for mount.
   */
  const tz = zoneFor(locale);
  const window = useMemo(() => {
    if (!w.window_start || !w.window_end) return "";
    if (!tz && !mounted) return "";
    const f = new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    });
    return `${f.format(new Date(w.window_start))}–${f.format(new Date(w.window_end))}`;
  }, [w.window_start, w.window_end, locale, mounted, tz]);

  /**
   * Under two minutes the book has usually converged past anything worth
   * taking, so the window is shown but not offered. Previously it was filtered
   * out upstream, which meant the market a viewer is actually watching tick
   * simply vanished from the board for its last two minutes.
   */
  const closing = left != null && left < 120;

  // A window with no elapsed time has no price series to draw yet.
  const startMs = w.window_start ? new Date(w.window_start).getTime() : null;
  const started = startMs != null && Date.now() >= startMs;
  const ended = left != null && left <= 0;

  return (
    <li className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
      <div className="flex items-baseline justify-between gap-4">
        <span className="flex items-baseline gap-2">
          <span className="text-[16px] font-bold tracking-[-0.02em]">{w.asset}</span>
          {closing && (
            <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--down)]">
              {copy.closing}
            </span>
          )}
        </span>
        <span className="font-mono text-[12px] text-[var(--faint)]">
          <span className="ltr-num">{window}</span>
        </span>
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-4">
        <span className="font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]">
          {copy.closesIn}{" "}
          <span
            className="ltr-num tabular-nums"
            style={{ color: closing ? "var(--down)" : "var(--ink)" }}
          >
            {!mounted || left == null
              ? "—"
              : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}
          </span>
        </span>
        {w.volume != null && (
          <span className="font-mono text-[11px] text-[var(--faint)]">
            {copy.volume} <span className="ltr-num">${Math.round(w.volume).toLocaleString("en-US")}</span>
          </span>
        )}
      </div>

      {/* Price, anchor and running average — the question the market asks.
          The odds sparkline below is the market's answer to it. */}
      <PriceChart
        slug={w.slug}
        live={started && !ended}
        labels={{
          notStarted: copy.notStarted,
          loading: copy.loadingPrices,
          anchor: copy.anchor,
          average: copy.average,
          price: copy.price,
        }}
      />

      <OddsSpark points={points} waiting={copy.waiting} />

      <div className="mt-3 grid grid-cols-2 gap-2" style={closing ? { opacity: 0.45 } : undefined}>
        <div className="rounded-xl border border-[var(--line)] px-3 py-2 text-center">
          <div className="text-[11px] font-medium text-[var(--mute)]">{copy.up}</div>
          <div className="ltr-num text-[20px] font-bold text-[var(--up)]">{cents(up)}</div>
        </div>
        <div className="rounded-xl border border-[var(--line)] px-3 py-2 text-center">
          <div className="text-[11px] font-medium text-[var(--mute)]">{copy.down}</div>
          <div className="ltr-num text-[20px] font-bold text-[var(--down)]">{cents(down)}</div>
        </div>
      </div>
    </li>
  );
}

/**
 * Sparkline of the Up price over the window.
 *
 * Fixed 0–1 domain rather than min/max of the observed points. Auto-scaling
 * would magnify a one-cent wobble into a dramatic swing and make a market
 * sitting flat at 50/50 look violently volatile — the opposite of what the
 * viewer needs to know. A fixed domain means the slope on screen is the real
 * slope, and the 50c line is always in the same place.
 */
function OddsSpark({ points, waiting }: { points: Point[]; waiting: string }) {
  const W = 320;
  const H = 56;

  if (points.length < 2) {
    return (
      <div
        className="mt-3 flex h-[56px] items-center justify-center rounded-xl border border-dashed border-[var(--line)]"
        aria-hidden
      >
        <span className="font-mono text-[11px] text-[var(--faint)]">{waiting}</span>
      </div>
    );
  }

  const t0 = points[0]!.t;
  const tN = points[points.length - 1]!.t;
  const span = Math.max(1, tN - t0);
  const x = (t: number) => ((t - t0) / span) * W;
  const y = (p: number) => H - p * H;

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.up).toFixed(1)}`).join(" ");
  const last = points[points.length - 1]!;
  const rising = last.up >= points[0]!.up;
  const stroke = rising ? "var(--up)" : "var(--down)";

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--line)]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[56px] w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Up ${Math.round(last.up * 100)}%`}
      >
        {/* The 50c line — the only reference that matters on a binary. */}
        <line
          x1="0"
          y1={y(0.5)}
          x2={W}
          y2={y(0.5)}
          stroke="var(--line)"
          strokeWidth="1"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
