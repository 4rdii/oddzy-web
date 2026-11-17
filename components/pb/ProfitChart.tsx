"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { money, num, type PbLang } from "@/lib/pb";
import type { Dict } from "@/lib/dict/en";

/**
 * A trader's cumulative profit over time: a dated line with a dollar axis, a
 * crosshair that snaps to the nearest day (pointer, touch or arrow keys), and
 * 30-day / 90-day / all ranges.
 *
 * Hand-built SVG, like the other charts on the site: one series and a hundred
 * points do not justify a charting bundle in the trader popup.
 *
 * The plot always runs left to right, in Persian too: time on a chart reads
 * that way everywhere, and mirroring it would only make it look wrong. The
 * labels around it are localised.
 */

type T = Dict["traders"];
type Range = "30" | "90" | "all";
export type Curve = { t: number[]; v: number[] };

const DAY_MS = 86_400_000;
const H = 232;
const PAD = { top: 12, bottom: 26, left: 6 };

/** A "nice" step for about `count` gridlines across `span`. */
function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

/** Axis money: short enough for a gutter. "$10K" / «۱۰ هزار». */
function axisMoney(lang: PbLang, n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const trim = (x: number, d: number) => String(Number(x.toFixed(d)));
  if (lang === "fa") {
    if (a >= 1e6) return `${sign}${num(lang, trim(a / 1e6, 1))} میلیون`;
    if (a >= 1e3) return `${sign}${num(lang, trim(a / 1e3, a >= 1e4 ? 0 : 1))} هزار`;
    return `${sign}${num(lang, Math.round(a))}`;
  }
  if (a >= 1e6) return `${sign}$${trim(a / 1e6, 1)}M`;
  if (a >= 1e3) return `${sign}$${trim(a / 1e3, a >= 1e4 ? 0 : 1)}K`;
  return `${sign}$${Math.round(a)}`;
}
const signedMoney = (lang: PbLang, n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${money(lang, Math.abs(n))}`;

export function ProfitChart({ curve, lang, t }: { curve: Curve; lang: PbLang; t: T }) {
  const wrap = useRef<HTMLDivElement>(null);
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

  const lastDay = curve.t[curve.t.length - 1];
  const spanDays = lastDay - curve.t[0];
  const pts = useMemo(() => {
    const from = range === "all" ? -Infinity : lastDay - Number(range);
    const out: { d: number; v: number }[] = [];
    for (let i = 0; i < curve.t.length; i++) if (curve.t[i] >= from) out.push({ d: curve.t[i], v: curve.v[i] });
    return out;
  }, [curve, range, lastDay]);

  // Amounts: Persian ones ("+۷۰ هزار دلار") must flow right-to-left like the
  // rest of the page; forcing LTR on them put the unit before the number.
  const numDir = lang === "fa" ? "rtl" : "ltr";
  const locale = lang === "fa" ? "fa-IR" : "en-US";
  const fmtDay = (d: number, year: boolean) =>
    new Date(d * DAY_MS).toLocaleDateString(locale, { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });

  const gutter = lang === "fa" ? 62 : 50; // room for the dollar labels, on the right
  const plotW = Math.max(40, w - PAD.left - gutter);
  const plotH = H - PAD.top - PAD.bottom;

  const geo = useMemo(() => {
    if (pts.length < 2) return null;
    const vs = pts.map((p) => p.v);
    let lo = Math.min(...vs);
    let hiV = Math.max(...vs);
    if (hiV - lo < 1) {
      lo -= 1;
      hiV += 1;
    }
    // Gridlines land on round dollars; the scale runs to the gridlines just
    // outside the data, so the line never touches the frame.
    const step = niceStep(hiV - lo, 3);
    const y0 = Math.floor(lo / step) * step;
    const y1 = Math.ceil(hiV / step) * step;
    const ticks: number[] = [];
    for (let v = y0; v <= y1 + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
    const d0 = pts[0].d;
    const d1 = pts[pts.length - 1].d;
    const x = (d: number) => PAD.left + ((d - d0) / Math.max(1, d1 - d0)) * plotW;
    const y = (v: number) => PAD.top + (1 - (v - y0) / (y1 - y0)) * plotH;
    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    const area = `${line} L${x(d1).toFixed(1)},${(PAD.top + plotH).toFixed(1)} L${x(d0).toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`;
    // Date labels at even intervals: fewer on a phone.
    const n = plotW < 380 ? 3 : plotW < 620 ? 4 : 5;
    const xt = Array.from({ length: n }, (_, i) => Math.round(d0 + ((d1 - d0) * i) / (n - 1)));
    return { x, y, line, area, ticks, xt, d0, d1, y0, y1 };
  }, [pts, plotW, plotH]);

  if (!geo) return null;

  const first = pts[0];
  const last = pts[pts.length - 1];
  const change = last.v - first.v;
  const up = change >= 0;
  const color = up ? "var(--up)" : "var(--down)";
  const sel = hi !== null && hi < pts.length ? pts[hi] : null;

  /** Nearest point to a pointer position: the reader aims at a date, not at a 2px line. */
  const nearest = (clientX: number) => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return null;
    const px = clientX - box.left;
    const day = geo.d0 + ((px - PAD.left) / plotW) * (geo.d1 - geo.d0);
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].d - day) < Math.abs(pts[best].d - day)) best = i;
    return best;
  };

  const ranges: [Range, string][] = [
    ...(spanDays > 35 ? ([["30", t.chartRange30]] as [Range, string][]) : []),
    ...(spanDays > 100 ? ([["90", t.chartRange90]] as [Range, string][]) : []),
    ["all", t.chartRangeAll],
  ];
  const showYear = geo.d1 - geo.d0 > 330;
  const tipX = sel ? geo.x(sel.d) : 0;
  const tipLeft = sel ? Math.min(Math.max(tipX - 74, 0), Math.max(0, w - 148)) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.4, color: "var(--text)" }} dir={numDir}>
            {signedMoney(lang, (sel ?? last).v)}
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {sel ? fmtDay(sel.d, true) : `${t.chartChange} ${signedMoney(lang, change)} · ${fmtDay(first.d, showYear)} – ${fmtDay(last.d, showYear)}`}
          </span>
        </div>
        {ranges.length > 1 && (
          <div role="group" aria-label={t.chartRangeLabel} style={{ display: "flex", gap: 6 }}>
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
                  style={{
                    padding: "6px 11px",
                    borderRadius: 9,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    border: `1px solid ${on ? "var(--goldline)" : "var(--line)"}`,
                    background: on ? "var(--goldbg)" : "transparent",
                    color: on ? "var(--gold)" : "var(--text2)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div
        ref={wrap}
        dir="ltr"
        tabIndex={0}
        role="img"
        aria-label={`${t.curveTitle}: ${fmtDay(first.d, true)} – ${fmtDay(last.d, true)}, ${signedMoney(lang, first.v)} → ${signedMoney(lang, last.v)}`}
        onPointerMove={(e) => setHi(nearest(e.clientX))}
        onPointerDown={(e) => setHi(nearest(e.clientX))}
        onPointerLeave={() => setHi(null)}
        onBlur={() => setHi(null)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          setHi((i) => Math.min(pts.length - 1, Math.max(0, (i ?? pts.length - 1) + (e.key === "ArrowRight" ? 1 : -1))));
        }}
        style={{
          position: "relative",
          height: H,
          borderRadius: 12,
          border: "1px solid var(--line)",
          background: "var(--card2)",
          cursor: "crosshair",
          touchAction: "pan-y",
          outlineOffset: 2,
          userSelect: "none",
        }}
      >
        {w > 0 && (
          <svg width={w} height={H} aria-hidden style={{ display: "block" }}>
            <defs>
              <linearGradient id="tl-profit-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity="0.2" />
                <stop offset="1" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {geo.ticks.map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={PAD.left + plotW} y1={geo.y(v)} y2={geo.y(v)} stroke={v === 0 ? "var(--line2)" : "var(--line)"} strokeWidth="1" />
                <text x={PAD.left + plotW + 8} y={geo.y(v) + 4} fontSize="11" fill="var(--muted)">
                  {axisMoney(lang, v)}
                </text>
              </g>
            ))}
            {geo.xt.map((d, i) => (
              <text
                key={d}
                x={geo.x(d)}
                y={H - 8}
                fontSize="11"
                fill="var(--muted)"
                textAnchor={i === 0 ? "start" : i === geo.xt.length - 1 ? "end" : "middle"}
              >
                {fmtDay(d, false)}
              </text>
            ))}
            <path d={geo.area} fill="url(#tl-profit-fill)" />
            <path d={geo.line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {sel && (
              <>
                <line x1={tipX} x2={tipX} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--line2)" strokeWidth="1" />
                <circle cx={tipX} cy={geo.y(sel.v)} r="5" fill={color} stroke="var(--card2)" strokeWidth="2" />
              </>
            )}
          </svg>
        )}
        {sel && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: tipLeft,
              width: 148,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid var(--line2)",
              background: "var(--card)",
              boxShadow: "0 10px 26px -14px rgba(0,0,0,0.6)",
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              gap: 3,
              direction: lang === "fa" ? "rtl" : "ltr",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }} dir={numDir}>
              {signedMoney(lang, sel.v)}
            </span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDay(sel.d, true)}</span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              {t.chartSinceStart} <b style={{ color: "var(--text2)" }} dir={numDir}>{signedMoney(lang, sel.v - first.v)}</b>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
