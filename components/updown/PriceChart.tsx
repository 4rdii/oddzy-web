"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * The window's price, drawn as one line against the price it has to beat.
 *
 * TWO THINGS HERE ARE NOT OPTIONAL, and both exist because a fifteen-minute
 * crypto window barely moves in relative terms — measured live, a BTC window
 * travels about 0.006% of its own price, ETH and SOL under 0.1%.
 *
 * 1. THE Y-DOMAIN HAS A FLOOR. Scaling to the observed min/max alone turns a
 *    $3 wobble on $64,000 into a mountain range that fills the frame, which
 *    reads as violent volatility on a market that has done nothing. The floor
 *    is a fraction of the price itself, so a flat window looks flat and a real
 *    move still has room to show.
 *
 * 2. THE SERIES IS BUCKETED. The feed is one bar per second, so a full window
 *    is ~900 points across ~800px — more vertices than pixels, drawn as raw
 *    segments that alias into a sawtooth. Averaging into buckets and curving
 *    through them shows the shape that is actually there instead of the
 *    sampling grid.
 *
 * What is deliberately NOT drawn: a running-average line. These markets settle
 * on the time-weighted average versus the open, not on the closing price, so
 * that line is the one that literally decides the outcome — but it is carried
 * as a figure beside the chart rather than a second line on it, because two
 * lines a few dollars apart on this scale are indistinguishable and the chart
 * stops being readable. The number does the honest work; the line is the shape.
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
  open: string;
  now: string;
  close: string;
};

/** Full window length in seconds. The x-axis is always the whole window. */
const WINDOW_S = 900;

/**
 * Vertices in the drawn line. Roughly one per 7px at full width — enough to
 * keep every real inflection, few enough that the curve reads as a line rather
 * than as hatching.
 */
const BUCKETS = 90;

/**
 * Smallest half-height of the y-axis, as a fraction of the anchor price.
 *
 * 0.08% each way. Tuned against live windows of all three coins: at this floor
 * a quiet BTC window (0.04% travelled) uses about 19% of the plot height, ETH
 * 48%, SOL 57% — so the difference between a dead market and a moving one is
 * visible at a glance. Without the floor all three filled ~80% of the frame
 * regardless, which is the bug that made a $3 wobble on $64,000 look like a
 * crash. Raise it much further and everything flattens into a dead line.
 *
 * A move larger than the floor still expands the domain normally; this only
 * sets how much room the quiet case gets.
 */
const MIN_HALF_SPAN = 0.0008;

/**
 * The window's price series.
 *
 * Lifted out of the chart because the headline figures above it are read from
 * the SAME series. Fetching twice would let the two disagree by a poll, which on
 * a countdown market is the difference between "you are winning" and "you are
 * not".
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
    if (pending || !slug) return;
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

/** Mean price per time bucket. Averaging, not sampling — a picked point would
 *  inherit that second's jitter, which is the thing being removed. */
function bucket(points: Array<{ t: number; p: number }>, n: number) {
  if (points.length <= n) return points.map((d) => ({ t: d.t, p: d.p }));
  const t0 = points[0]!.t;
  const span = Math.max(1, points[points.length - 1]!.t - t0);
  const sums = new Array<number>(n).fill(0);
  const counts = new Array<number>(n).fill(0);
  const times = new Array<number>(n).fill(0);
  for (const d of points) {
    const i = Math.min(n - 1, Math.floor(((d.t - t0) / span) * n));
    sums[i]! += d.p;
    counts[i]! += 1;
    times[i]! += d.t;
  }
  const out: Array<{ t: number; p: number }> = [];
  for (let i = 0; i < n; i++) {
    if (counts[i]! === 0) continue;
    out.push({ t: times[i]! / counts[i]!, p: sums[i]! / counts[i]! });
  }
  return out;
}

/**
 * Catmull-Rom through the points, emitted as cubic beziers.
 *
 * Chosen over a plain polyline because the curve passes exactly THROUGH every
 * vertex — it smooths the join, never the value. A fitted or averaged spline
 * would move the line off the prices it is drawing, which on a chart someone
 * is about to stake money against is not a cosmetic difference.
 */
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return "";
  if (pts.length < 3) {
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  }
  let d = `M${pts[0]!.x.toFixed(1)},${pts[0]!.y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export function PriceChart({
  data,
  labels,
  live,
  accent,
  decimals,
  /** True when the window has not opened yet, so there is nothing to draw. */
  pending = false,
  height = 250,
}: {
  data: PriceSeries | null;
  labels: ChartLabels;
  /** Drives the pulsing head dot and the "now" axis label. */
  live: boolean;
  /** The coin's brand colour. */
  accent: string;
  decimals: number;
  pending?: boolean;
  height?: number;
}) {
  const W = 840;
  const H = 290;
  const L = 14;
  const R = 92;
  const T = 16;
  const B = 30;

  const geom = useMemo(() => {
    if (!data || data.points.length < 2 || data.anchor == null) return null;
    const anchor = data.anchor;
    const pts = bucket(data.points, BUCKETS);
    if (pts.length < 2) return null;

    const values = [...pts.map((d) => d.p), anchor];
    let lo = Math.min(...values);
    let hi = Math.max(...values);

    // The floor, centred on the anchor so the reference line stays put as the
    // domain grows rather than sliding around under the price.
    const half = Math.max((hi - lo) / 2, anchor * MIN_HALF_SPAN);
    const mid = (hi + lo) / 2;
    lo = mid - half * 1.25;
    hi = mid + half * 1.25;

    const t0 = pts[0]!.t;
    // Always scale x across the FULL window so one in progress visibly fills
    // left-to-right instead of restretching itself on every poll.
    const x = (t: number) => L + ((t - t0) / WINDOW_S) * (W - L - R);
    const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));

    const xy = pts.map((d) => ({ x: x(d.t), y: y(d.p) }));
    const last = pts[pts.length - 1]!;

    return {
      path: smoothPath(xy),
      areaPath: `${smoothPath(xy)} L${xy[xy.length - 1]!.x.toFixed(1)},${H - B} L${xy[0]!.x.toFixed(1)},${H - B} Z`,
      anchorY: y(anchor),
      headX: x(last.t),
      headY: y(last.p),
      gridlines: [0.14, 0.38, 0.62, 0.86].map((f) => {
        const v = lo + (hi - lo) * f;
        return { v, y: y(v) };
      }),
      anchor,
    };
  }, [data]);

  if (pending || (data && !data.started)) {
    return <Placeholder text={labels.notStarted} height={height} />;
  }
  if (!geom) {
    return <Placeholder text={labels.loading} height={height} />;
  }

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
        aria-label={`${labels.anchor} ${fmt(geom.anchor)}`}
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

        {/* The price to beat. Dashed, per the reference design. */}
        <line
          x1={L} x2={W - R} y1={geom.anchorY} y2={geom.anchorY}
          stroke="var(--faint)" strokeWidth="1.2" strokeDasharray="6 5"
          vectorEffect="non-scaling-stroke"
        />
        <text x={L + 4} y={geom.anchorY - 8} fill="var(--mute)" fontSize="11.5">
          {labels.anchor}
        </text>

        <path d={geom.areaPath} fill={accent} opacity="0.07" />
        <path
          d={geom.path} fill="none" stroke={accent} strokeWidth="2.4"
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
    </div>
  );
}

function Placeholder({ text, height }: { text: string; height: number }) {
  return (
    <div
      className="mt-4 grid place-items-center rounded-2xl border border-dashed border-[var(--line)] px-6 text-center"
      style={{ height }}
    >
      <span className="text-[14px] text-[var(--faint)]">{text}</span>
    </div>
  );
}
