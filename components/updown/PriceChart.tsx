"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * The window's price, its opening anchor, and the running average that actually
 * decides the market.
 *
 * These resolve on whether the AVERAGE price across the window finishes at or
 * above the price when the window opened. Plotting price alone would invite the
 * wrong conclusion — a viewer watching spot come back to its opening level reads
 * "Down", while an average that sat above the open all window resolves Up. So
 * all three lines are drawn together, and the one that answers the question (the
 * TWAP against the anchor) is the emphasised one; raw price is context.
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

export function PriceChart({
  slug,
  labels,
  live,
}: {
  slug: string;
  labels: { notStarted: string; loading: string; anchor: string; average: string; price: string };
  /** Poll only while the window is running; a finished one never changes. */
  live: boolean;
}) {
  const [data, setData] = useState<PriceSeries | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
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
        if (!cancelled) setData(json);
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
  }, [slug, live]);

  const W = 320;
  const H = 96;

  const geom = useMemo(() => {
    if (!data || data.points.length < 2 || data.anchor == null) return null;
    const ps = data.points;
    // The anchor must be inside the domain even if price never returned to it,
    // or the reference line clips off the chart and the comparison is unreadable.
    const values = [...ps.map((d) => d.p), ...ps.map((d) => d.twap), data.anchor];
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.12;
    lo -= pad; hi += pad;

    const t0 = ps[0]!.t;
    // Always scale x across the FULL 900s window, not just the bars received, so
    // a window in progress visibly fills left-to-right instead of restretching
    // itself on every poll.
    const x = (t: number) => ((t - t0) / 900) * W;
    const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;

    const line = (get: (d: (typeof ps)[number]) => number) =>
      ps.map((d, i) => `${i === 0 ? "M" : "L"}${x(d.t).toFixed(1)},${y(get(d)).toFixed(1)}`).join(" ");

    const last = ps[ps.length - 1]!;
    return {
      pricePath: line((d) => d.p),
      twapPath: line((d) => d.twap),
      anchorY: y(data.anchor),
      winning: last.twap >= data.anchor,
      lastTwap: last.twap,
      lastPrice: last.p,
      anchor: data.anchor,
    };
  }, [data]);

  if (data && !data.started) {
    return <Placeholder text={labels.notStarted} />;
  }
  if (!geom) {
    return <Placeholder text={labels.loading} />;
  }

  const twapColor = geom.winning ? "var(--up)" : "var(--down)";
  const fmt = (v: number) =>
    v >= 1000 ? Math.round(v).toLocaleString("en-US") : v.toFixed(2);

  return (
    <div className="mt-3">
      <div className="overflow-hidden rounded-xl border border-[var(--line)]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[96px] w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${labels.average} ${fmt(geom.lastTwap)}, ${labels.anchor} ${fmt(geom.anchor)}`}
        >
          {/* Anchor — the number the average is compared against. */}
          <line
            x1="0" y1={geom.anchorY} x2={W} y2={geom.anchorY}
            stroke="var(--faint)" strokeWidth="1" strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
          {/* Raw price: context, deliberately de-emphasised. */}
          <path
            d={geom.pricePath} fill="none" stroke="var(--faint)" strokeWidth="1"
            strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity="0.55"
          />
          {/* The running average — the line that decides the market. */}
          <path
            d={geom.twapPath} fill="none" stroke={twapColor} strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-[var(--faint)]">
        <span style={{ color: twapColor }}>
          ● {labels.average} <span className="ltr-num">{fmt(geom.lastTwap)}</span>
        </span>
        <span>┈ {labels.anchor} <span className="ltr-num">{fmt(geom.anchor)}</span></span>
        <span>{labels.price} <span className="ltr-num">{fmt(geom.lastPrice)}</span></span>
      </div>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="mt-3 flex h-[96px] items-center justify-center rounded-xl border border-dashed border-[var(--line)]">
      <span className="font-mono text-[11px] text-[var(--faint)]">{text}</span>
    </div>
  );
}
