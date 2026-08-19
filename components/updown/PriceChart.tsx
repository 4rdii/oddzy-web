"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * The hero chart: the window's price, its opening anchor, and the running
 * average that actually decides the market.
 *
 * These resolve on whether the AVERAGE price across the window finishes at or
 * above the price when the window opened. Plotting price alone would invite the
 * wrong conclusion — a viewer watching spot come back to its opening level reads
 * "Down", while an average that sat above the open all window resolves Up. So
 * all three lines are drawn together, and the one that answers the question (the
 * TWAP against the anchor) is the emphasised one; raw price is context.
 *
 * NOTE FOR ANYONE PORTING POLYMARKET'S OWN UP/DOWN CHART: theirs draws a single
 * price line against a dashed "Target" and is correct *for them* — their 5m
 * markets resolve on last price versus the price to beat. Ours do not. Copying
 * that chart across would import a resolution rule we do not have, onto a page
 * where the reader is deciding what to stake. The dashed line here is the
 * anchor, and the bold line is the average, precisely so the picture cannot
 * disagree with the question.
 *
 * The y-domain is the observed price range with padding, NOT a fixed domain like
 * the odds sparkline. Opposite reasoning: odds live in a known 0–1 space where a
 * fixed scale keeps a flat market looking flat, whereas price has no natural
 * bounds and a 15-minute move is a tiny fraction of the absolute value — a fixed
 * or zero-based scale would render every window as a dead flat line.
 */

export type PriceSeries = {
  anchor: number | null;
  points: Array<{ t: number; p: number; twap: number }>;
  started: boolean;
  complete: boolean;
};

export type ChartLabels = {
  notStarted: string;
  loading: string;
  anchor: string;
  average: string;
  price: string;
  open: string;
  now: string;
  close: string;
};

/** Full window length in seconds. The x-axis is always the whole window. */
const WINDOW_S = 900;

/**
 * The window's price series.
 *
 * Lifted out of the chart because the headline figures above it — price to beat,
 * current price, the delta between them — are read from the SAME series. Fetching
 * twice would let the two disagree by a poll, which on a countdown market is the
 * difference between "you are winning" and "you are not".
 */
export function useWindowPrices(slug: string, live: boolean, pending: boolean) {
  /**
   * The slug is stored WITH the series rather than the series being cleared when
   * the slug changes. Same effect — a previous window's prices never render
   * under a new window's heading — but it happens during render, where it is a
   * pure comparison, instead of as a setState inside an effect that would cost a
   * second render pass on every switch.
   */
  const [cache, setCache] = useState<{ slug: string; data: PriceSeries } | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (pending) return;
    let cancelled = false;
    const load = async () => {
      abort.current?.abort();
      const ac = new AbortController();
      abort.current = ac;
      try {
        const res = await fetch(`/api/updown/prices?slug=${encodeURIComponent(slug)}`, {
          signal: ac.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as PriceSeries;
        if (!cancelled) setCache({ slug, data: json });
      } catch {
        // Aborted or transient — keep the last good series rather than blanking.
      }
    };
    void load();
    if (!live) return () => { cancelled = true; abort.current?.abort(); };
    const id = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
      abort.current?.abort();
    };
  }, [slug, live, pending]);

  return cache && cache.slug === slug && !pending ? cache.data : null;
}

export function PriceChart({
  data,
  labels,
  live,
  accent,
  decimals,
  /** True when the window has not opened yet, so there is nothing to draw. */
  pending = false,
}: {
  data: PriceSeries | null;
  labels: ChartLabels;
  /** Drives the pulsing head dot and the "now" axis label. */
  live: boolean;
  /** The coin's brand colour, used for the raw-price line and its head dot. */
  accent: string;
  decimals: number;
  pending?: boolean;
}) {
  // Generous right gutter for the price axis, which sits inside the plot the way
  // a trading chart's does rather than stealing width from a narrow card.
  const W = 840;
  const H = 290;
  const L = 14;
  const R = 92;
  const T = 16;
  const B = 30;

  const geom = useMemo(() => {
    if (!data || data.points.length < 2 || data.anchor == null) return null;
    const ps = data.points;
    // The anchor must be inside the domain even if price never returned to it,
    // or the reference line clips off the chart and the comparison is unreadable.
    const values = [...ps.map((d) => d.p), ...ps.map((d) => d.twap), data.anchor];
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.16;
    lo -= pad; hi += pad;

    const t0 = ps[0]!.t;
    // Always scale x across the FULL window, not just the bars received, so a
    // window in progress visibly fills left-to-right instead of restretching
    // itself on every poll.
    const x = (t: number) => L + ((t - t0) / WINDOW_S) * (W - L - R);
    const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));

    const line = (get: (d: (typeof ps)[number]) => number) =>
      ps.map((d, i) => `${i === 0 ? "M" : "L"}${x(d.t).toFixed(1)},${y(get(d)).toFixed(1)}`).join(" ");

    const last = ps[ps.length - 1]!;
    const gridlines = [0.14, 0.38, 0.62, 0.86].map((f) => {
      const v = lo + (hi - lo) * f;
      return { v, y: y(v) };
    });

    return {
      pricePath: line((d) => d.p),
      twapPath: line((d) => d.twap),
      anchorY: y(data.anchor),
      headX: x(last.t),
      headY: y(last.p),
      gridlines,
      winning: last.twap >= data.anchor,
      lastTwap: last.twap,
      lastPrice: last.p,
      anchor: data.anchor,
    };
  }, [data]);

  if (pending || (data && !data.started)) {
    return <Placeholder text={labels.notStarted} />;
  }
  if (!geom) {
    return <Placeholder text={labels.loading} />;
  }

  const twapColor = geom.winning ? "var(--up)" : "var(--down)";
  const fmt = (v: number) =>
    v >= 1000
      ? v.toLocaleString("en-US", { maximumFractionDigits: 0 })
      : v.toFixed(decimals);

  return (
    <div className="mt-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`${labels.average} ${fmt(geom.lastTwap)}, ${labels.anchor} ${fmt(geom.anchor)}`}
      >
        {geom.gridlines.map((g, i) => (
          <g key={i}>
            <line
              x1={L} x2={W - R + 6} y1={g.y} y2={g.y}
              stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke"
            />
            <text
              x={W - R + 12} y={g.y + 4}
              fill="var(--faint)" fontSize="11.5" className="ltr-num"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              ${fmt(g.v)}
            </text>
          </g>
        ))}

        {/* The anchor — the number the average is compared against. */}
        <line
          x1={L} x2={W - R} y1={geom.anchorY} y2={geom.anchorY}
          stroke="var(--faint)" strokeWidth="1.2" strokeDasharray="6 5"
          vectorEffect="non-scaling-stroke"
        />
        <text x={L + 4} y={geom.anchorY - 8} fill="var(--mute)" fontSize="11.5">
          {labels.anchor}
        </text>

        {/* Raw price: context, deliberately de-emphasised against the average. */}
        <path
          d={geom.pricePath} fill="none" stroke={accent} strokeWidth="1.6"
          strokeLinejoin="round" strokeLinecap="round" opacity="0.5"
          vectorEffect="non-scaling-stroke"
        />
        {/* The running average — the line that decides the market. */}
        <path
          d={geom.twapPath} fill="none" stroke={twapColor} strokeWidth="2.6"
          strokeLinejoin="round" strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {live && (
          <circle
            cx={geom.headX} cy={geom.headY} r="5" fill={accent}
            style={{
              transformOrigin: `${geom.headX}px ${geom.headY}px`,
              animation: "updownPulse 2s ease-out infinite",
            }}
          />
        )}
        <circle
          cx={geom.headX} cy={geom.headY} r="4"
          fill={accent} stroke="var(--card)" strokeWidth="1.5"
        />

        <text x={L} y={H - 8} fill="var(--faint)" fontSize="11">{labels.open}</text>
        <text x={W - R} y={H - 8} fill="var(--faint)" fontSize="11" textAnchor="end">
          {live ? labels.now : labels.close}
        </text>
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-[var(--faint)]">
        <span style={{ color: twapColor }}>
          ● {labels.average} <span className="ltr-num">{fmt(geom.lastTwap)}</span>
        </span>
        <span>┈ {labels.anchor} <span className="ltr-num">{fmt(geom.anchor)}</span></span>
        <span style={{ color: accent }}>
          — {labels.price} <span className="ltr-num">{fmt(geom.lastPrice)}</span>
        </span>
      </div>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="mt-4 grid h-[250px] place-items-center rounded-2xl border border-dashed border-[var(--line)] px-6 text-center">
      <span className="text-[14px] text-[var(--faint)]">{text}</span>
    </div>
  );
}
