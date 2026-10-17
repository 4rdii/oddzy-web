"use client";

import { useState } from "react";
import { chartPaths } from "@/lib/od";

/**
 * OdChart: the YES-price history with 1W / 1M / 3M ranges and a hover
 * readout. `points` are daily closes, oldest first, ending today; `days` are
 * their dates (ISO). Ranges longer than the history just show all of it.
 */
export function OdChart({ points, days, height = 220 }: { points: number[]; days: string[]; height?: number }) {
  const [n, setN] = useState(30);
  const [i, setI] = useState<number | null>(null);
  const take = Math.min(n, points.length);
  const pts = points.slice(-take);
  const ds = days.slice(-take);
  const c = chartPaths(pts, 600, 200);
  const fmt = (iso: string | undefined) =>
    iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "";
  const label = n === 7 ? "WEEK" : n === 30 ? "MONTH" : "3 MONTHS";
  const one = pts.length < 2;

  return (
    <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span className="mono" style={{ fontWeight: 500, fontSize: 11.5, color: "var(--od-ink3)" }}>
          {one ? "YES PRICE · HISTORY STARTS TODAY" : i === null ? `YES PRICE · LAST ${label}` : `${fmt(ds[i]).toUpperCase()} · ${Math.round(pts[i])}%`}
        </span>
        <div style={{ display: "flex", gap: 2, padding: 2, borderRadius: 8, background: "var(--od-chip)" }}>
          {(
            [
              [7, "1W"],
              [30, "1M"],
              [90, "3M"],
            ] as const
          ).map(([k, lab]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setN(k);
                setI(null);
              }}
              className="mono"
              style={{
                height: 26,
                padding: "0 10px",
                border: 0,
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 11.5,
                background: n === k ? "var(--od-panel)" : "transparent",
                color: n === k ? "var(--od-ink)" : "var(--od-ink3)",
              }}
            >
              {lab}
            </button>
          ))}
        </div>
      </div>
      <div
        onMouseMove={(e) => {
          if (one) return;
          const r = e.currentTarget.getBoundingClientRect();
          setI(Math.max(0, Math.min(pts.length - 1, Math.round(((e.clientX - r.left) / r.width) * (pts.length - 1)))));
        }}
        onMouseLeave={() => setI(null)}
        style={{ position: "relative", height, cursor: "crosshair" }}
      >
        <div style={{ position: "absolute", insetInline: 0, top: 0, borderTop: "1px dashed var(--od-line2)" }} />
        <div style={{ position: "absolute", insetInline: 0, top: "50%", borderTop: "1px dashed var(--od-line)" }} />
        <div style={{ position: "absolute", insetInline: 0, bottom: 0, borderTop: "1px solid var(--od-line)" }} />
        <span className="mono" style={{ position: "absolute", insetInlineEnd: 0, top: 2, fontWeight: 500, fontSize: 10, color: "var(--od-ink3)" }}>
          100%
        </span>
        <span className="mono" style={{ position: "absolute", insetInlineEnd: 0, top: "calc(50% + 2px)", fontWeight: 500, fontSize: 10, color: "var(--od-ink3)" }}>
          50%
        </span>
        <svg viewBox="0 0 600 200" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }} aria-hidden>
          <path d={c.area} style={{ fill: "var(--od-brand)", fillOpacity: 0.12 }} />
          <path d={c.line} style={{ fill: "none", stroke: "var(--od-brand)", strokeWidth: 2 }} vectorEffect="non-scaling-stroke" />
        </svg>
        {i !== null && (
          <>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${((i / (pts.length - 1)) * 100).toFixed(2)}%`, borderInlineStart: "1px solid var(--od-ink3)" }} />
            <span
              style={{
                position: "absolute",
                left: `${((i / (pts.length - 1)) * 100).toFixed(2)}%`,
                top: `${100 - pts[i]}%`,
                width: 9,
                height: 9,
                margin: "-4.5px 0 0 -4.5px",
                borderRadius: "50%",
                background: "var(--od-ink)",
              }}
            />
          </>
        )}
      </div>
      <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontWeight: 500, fontSize: 10.5, color: "var(--od-ink3)" }}>
        <span>{fmt(ds[0])}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
