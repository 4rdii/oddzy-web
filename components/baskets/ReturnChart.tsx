"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * A creator's running profit, day by day: a dated line with a dollar axis, a
 * crosshair that snaps to the nearest day (pointer, touch or arrow keys), a dot
 * on every day a basket settled, and 30-day / 90-day / all ranges.
 *
 * The same reading experience as the trader library's ProfitChart, with one
 * thing that chart cannot show: what happened ON the day. Each point knows the
 * baskets settled that day, so the tooltip names the day's result and its hit
 * count, which is the question a visitor actually has ("what was that drop?").
 *
 * Hand-built SVG like the other charts here. The plot runs left to right in
 * Persian too; only the labels around it are localised.
 */

export type ReturnDay = {
  /** YYYY-MM-DD. */
  day: string;
  /** Running profit in dollars at the end of this day. */
  v: number;
  /** Baskets settled on this day (empty on a day with none). */
  items: Array<{ slug: string; pnl: number; title: string | null; won: number | null; settled: number | null }>;
};

export type ReturnChartLabels = {
  range30: string;
  range90: string;
  rangeAll: string;
  rangeLabel: string;
  /** "That day" — the label before the day's own result. */
  thatDay: string;
  /** Shown for a day with no settled basket. */
  noBasket: string;
  /** "{n} baskets" — only used when a day has more than one. */
  baskets: string;
  /** "In this period" — the label before the change inside a 30/90-day range. */
  inPeriod: string;
  /** "{won} of {n} hit". */
  hitOf: string;
};

type Range = "30" | "90" | "all";

const H = 224;
const PAD = { top: 12, bottom: 26, left: 6 };
const GUTTER = 48; // room for the dollar labels, on the right

/** A dollar amount inside Persian text: kept left-to-right as one unit, or "+$43" reorders to "$43+". */
const LTR = { direction: "ltr", unicodeBidi: "isolate", display: "inline-block" } as const;

/** A "nice" step for about `count` gridlines across `span`. */
function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

const usd = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;
const axisUsd = (v: number) => `${v < 0 ? "−" : ""}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;

export function ReturnChart({
  days,
  title,
  meta,
  roll,
  locale,
  labels,
}: {
  days: ReturnDay[];
  title: string;
  /** The line under the total when nothing is selected. */
  meta: string;
  /** Profit against the capital a follower needed; shown beside the total. */
  roll: { pct: number; capital: number } | null;
  locale: string;
  labels: ReturnChartLabels;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const gradId = useId();
  const [w, setW] = useState(0);
  const [range, setRange] = useState<Range>("all");
  const [hi, setHi] = useState<number | null>(null);

  // Draw at the container's real width, so text and stroke never stretch.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // A finger lifts off the chart the moment it stops dragging, so on touch the
  // selection stays until the reader taps somewhere else.
  useEffect(() => {
    if (hi === null) return;
    const away = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setHi(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [hi]);

  const pts = useMemo(() => (range === "all" ? days : days.slice(-(Number(range) + 1))), [days, range]);

  const dateLocale = locale === "fa" ? "fa-IR" : "en-US";
  const fmtDay = (k: string, year: boolean) =>
    new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" }).format(
      new Date(`${k}T12:00:00Z`),
    );

  const plotW = Math.max(40, w - PAD.left - GUTTER);
  const plotH = H - PAD.top - PAD.bottom;

  const geo = useMemo(() => {
    if (pts.length < 2) return null;
    const vs = pts.map((p) => p.v);
    // The whole record is read against break-even, so $0 is always on the
    // scale. A 30- or 90-day window is read for its shape instead.
    let lo = Math.min(...vs, ...(range === "all" ? [0] : []));
    let hiV = Math.max(...vs, ...(range === "all" ? [0] : []));
    if (hiV - lo < 10) {
      lo -= 5;
      hiV += 5;
    }
    // Gridlines land on round dollars; the scale runs to the gridlines just
    // outside the data, so the line never touches the frame.
    const step = niceStep(hiV - lo, 3);
    const y0 = Math.floor(lo / step) * step;
    const y1 = Math.ceil(hiV / step) * step;
    const ticks: number[] = [];
    for (let v = y0; v <= y1 + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
    const n = pts.length - 1;
    const x = (i: number) => PAD.left + (i / n) * plotW;
    const y = (v: number) => PAD.top + (1 - (v - y0) / (y1 - y0)) * plotH;
    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    const floor = (PAD.top + plotH).toFixed(1);
    const area = `${line} L${x(n).toFixed(1)},${floor} L${x(0).toFixed(1)},${floor} Z`;
    // Date labels at even intervals: fewer on a phone.
    const want = plotW < 380 ? 3 : plotW < 620 ? 4 : 5;
    const xt = [...new Set(Array.from({ length: want }, (_, i) => Math.round((n * i) / (want - 1))))];
    return { x, y, line, area, ticks, xt, n };
  }, [pts, plotW, plotH, range]);

  if (!geo) return null;

  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const sel = hi !== null && hi < pts.length ? pts[hi]! : null;
  const shown = sel ?? last;
  const color = last.v >= 0 ? "var(--bk-gold)" : "var(--down)";
  const dayResult = (p: ReturnDay) => p.items.reduce((s, it) => s + it.pnl, 0);
  const tone = (v: number) => (v >= 0 ? "var(--bk-green)" : "var(--down)");

  /** Nearest day to a pointer position: the reader aims at a date, not at a 2px line. */
  const nearest = (clientX: number) => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return null;
    const i = Math.round(((clientX - box.left - PAD.left) / plotW) * geo.n);
    return Math.min(geo.n, Math.max(0, i));
  };

  const span = days.length - 1;
  const ranges: [Range, string][] = [
    ...(span > 35 ? ([["30", labels.range30]] as [Range, string][]) : []),
    ...(span > 100 ? ([["90", labels.range90]] as [Range, string][]) : []),
    ["all", labels.rangeAll],
  ];
  const showYear = pts.length > 330;
  const tipX = sel && hi !== null ? geo.x(hi) : 0;
  // The tooltip sits beside the crosshair, never on it: to the right while it
  // fits, else to the left, else (a phone) pushed to whichever edge is further.
  const tipW = w < 380 ? 156 : 172;
  const tipRight = tipX + 12;
  const tipLeftSide = tipX - 12 - tipW;
  const tipLeft =
    tipRight + tipW <= w ? tipRight : tipLeftSide >= 0 ? tipLeftSide : tipX < w / 2 ? Math.max(0, Math.min(tipRight, w - tipW)) : Math.max(tipLeftSide, 0);
  // A dot per settled day, once the days are far enough apart to tell them apart.
  const showDots = plotW / Math.max(1, geo.n) >= 4;
  const selItems = sel?.items ?? [];
  const selWon = selItems.reduce((s, it) => s + (it.won ?? 0), 0);
  const selSettled = selItems.reduce((s, it) => s + (it.settled ?? 0), 0);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] px-5 py-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[14px] font-extrabold text-[var(--ink)]">{title}</div>
        {ranges.length > 1 && (
          <div role="group" aria-label={labels.rangeLabel} className="flex gap-1.5">
            {ranges.map(([k, label]) => {
              const on = k === range;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setRange(k);
                    setHi(null);
                  }}
                  className="rounded-lg border px-2.5 py-1.5 text-[12px] font-bold"
                  style={{
                    borderColor: on ? "var(--bk-gold)" : "var(--line)",
                    background: on ? "var(--bk-goldtint)" : "transparent",
                    color: on ? "var(--bk-gold)" : "var(--mute)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex flex-wrap items-baseline gap-2 text-[24px] font-extrabold" style={{ color: shown.v >= 0 ? "var(--bk-gold)" : "var(--down)" }}>
          <span className="ltr-num">{usd(shown.v)}</span>
          {/* Against the capital actually needed: $100 unless the creator dug a hole. */}
          {!sel && range === "all" && roll && (
            <span className="ltr-num text-[12px] font-bold">
              ({roll.pct >= 0 ? "+" : ""}
              {Math.round(roll.pct)}% <span className="text-[var(--faint)]">/ ${Math.round(roll.capital)}</span>)
            </span>
          )}
        </div>
        <div className="text-[11px] text-[var(--faint)]">
          {sel ? (
            fmtDay(sel.day, true)
          ) : range === "all" ? (
            meta
          ) : (
            <>
              {labels.inPeriod}{" "}
              <b style={{ ...LTR, color: tone(last.v - first.v) }}>
                {usd(last.v - first.v)}
              </b>
              {" · "}
              {fmtDay(first.day, showYear)} – {fmtDay(last.day, showYear)}
            </>
          )}
        </div>
      </div>

      <div
        ref={wrap}
        dir="ltr"
        tabIndex={0}
        role="img"
        aria-label={`${title}: ${fmtDay(first.day, true)} – ${fmtDay(last.day, true)}, ${usd(first.v)} → ${usd(last.v)}`}
        onPointerMove={(e) => setHi(nearest(e.clientX))}
        onPointerDown={(e) => setHi(nearest(e.clientX))}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setHi(null);
        }}
        onBlur={() => setHi(null)}
        onKeyDown={(e) => {
          if (e.key === "Escape") return setHi(null);
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          setHi((i) => Math.min(geo.n, Math.max(0, (i ?? geo.n) + (e.key === "ArrowRight" ? 1 : -1))));
        }}
        style={{ position: "relative", height: H, cursor: "crosshair", touchAction: "pan-y", outlineOffset: 4, userSelect: "none" }}
      >
        {w > 0 && (
          <svg width={w} height={H} aria-hidden style={{ display: "block" }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity="0.22" />
                <stop offset="1" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {geo.ticks.map((v) => (
              <g key={v}>
                <line
                  x1={PAD.left}
                  x2={PAD.left + plotW}
                  y1={geo.y(v)}
                  y2={geo.y(v)}
                  stroke={v === 0 ? "var(--faint)" : "var(--line)"}
                  strokeWidth="1"
                  strokeDasharray={v === 0 ? "4 5" : undefined}
                  opacity={v === 0 ? 0.7 : 1}
                />
                <text x={PAD.left + plotW + 8} y={geo.y(v) + 4} fontSize="11" fill="var(--faint)">
                  {axisUsd(v)}
                </text>
              </g>
            ))}
            {geo.xt.map((i, k) => (
              <text
                key={i}
                x={geo.x(i)}
                y={H - 8}
                fontSize="11"
                fill="var(--faint)"
                textAnchor={k === 0 ? "start" : k === geo.xt.length - 1 ? "end" : "middle"}
              >
                {fmtDay(pts[i]!.day, false)}
              </text>
            ))}
            <path d={geo.area} fill={`url(#${gradId})`} />
            <path d={geo.line} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
            {showDots &&
              pts.map((p, i) =>
                p.items.length ? (
                  <circle key={p.day} cx={geo.x(i)} cy={geo.y(p.v)} r="2.6" fill={tone(dayResult(p))} stroke="var(--card)" strokeWidth="1" />
                ) : null,
              )}
            {sel && (
              <>
                <line x1={tipX} x2={tipX} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--faint)" strokeWidth="1" opacity="0.7" />
                <circle cx={tipX} cy={geo.y(sel.v)} r="5" fill={color} stroke="var(--card)" strokeWidth="2" />
              </>
            )}
          </svg>
        )}
        {sel && (
          <div
            style={{
              position: "absolute",
              top: 4,
              left: tipLeft,
              width: tipW,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "var(--card)",
              boxShadow: "0 10px 26px -12px rgba(0,0,0,0.45)",
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              gap: 3,
              direction: locale === "fa" ? "rtl" : "ltr",
            }}
          >
            <span className="text-[11px] text-[var(--mute)]">{fmtDay(sel.day, true)}</span>
            <span className="text-[15px] font-extrabold text-[var(--ink)]">
              <span style={LTR}>{usd(sel.v)}</span>
            </span>
            {selItems.length > 0 ? (
              <>
                <span className="text-[11px] text-[var(--mute)]">
                  {labels.thatDay}{" "}
                  <b style={{ ...LTR, color: tone(dayResult(sel)) }}>{usd(dayResult(sel))}</b>
                </span>
                {(selSettled > 0 || selItems.length > 1) && (
                  <span className="text-[11px] text-[var(--mute)]">
                    {[
                      selSettled > 0 ? labels.hitOf.replace("{won}", String(selWon)).replace("{n}", String(selSettled)) : null,
                      selItems.length > 1 ? labels.baskets.replace("{n}", String(selItems.length)) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
                {/* The basket's name, where there is room for it and only one to name. */}
                {selItems.length === 1 && selItems[0]!.title && w >= 380 && (
                  <span className="truncate text-[11px] text-[var(--faint)]">{selItems[0]!.title}</span>
                )}
              </>
            ) : (
              <span className="text-[11px] text-[var(--faint)]">{labels.noBasket}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
