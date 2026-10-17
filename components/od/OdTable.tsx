"use client";

import Link from "next/link";
import { useState } from "react";
import { chg, chgCol, fmtV, pct, type OdRow, type OdSort } from "@/lib/od";

/**
 * The question table (design: "All questions" / "Every X question"):
 * question, 30-day sparkline, YES, 24h change, volume, close, Trade. With
 * `chips`, a subtopic filter and Volume / Movers sorts, as on the section hubs.
 */
export function OdTable({
  rows,
  title,
  right,
  chips,
  showSub = true,
  limit = 40,
}: {
  rows: OdRow[];
  title: string;
  right?: string;
  chips?: { key: string; label: string }[];
  showSub?: boolean;
  limit?: number;
}) {
  const [sub, setSub] = useState("all");
  const [sort, setSort] = useState<OdSort>("vol");
  const [more, setMore] = useState(false);
  const sorter: Record<OdSort, (a: OdRow, b: OdRow) => number> = {
    vol: (a, b) => b.vol - a.vol,
    move: (a, b) => Math.abs(b.chg ?? 0) - Math.abs(a.chg ?? 0),
    tot: (a, b) => b.vol - a.vol,
  };
  const all = rows.filter((r) => sub === "all" || r.sub === sub).sort(sorter[sort]);
  const shown = more ? all : all.slice(0, limit);

  return (
    <div style={{ minWidth: 0 }}>
      <div className="sechead" style={{ marginBottom: chips ? 12 : 6, gap: 10 }}>
        <h2>{title}</h2>
        {chips ? (
          <div style={{ display: "flex", gap: 2, padding: 2, borderRadius: 8, background: "var(--od-chip)" }}>
            {(
              [
                ["vol", "Volume"],
                ["move", "Movers"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSort(k)}
                style={{ height: 28, padding: "0 10px", border: 0, borderRadius: 6, cursor: "pointer", fontSize: 12.5, fontWeight: 700, background: sort === k ? "var(--od-panel)" : "transparent", color: sort === k ? "var(--od-ink)" : "var(--od-ink3)" }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          right && (
            <span className="mono" style={{ fontWeight: 600, fontSize: 11, letterSpacing: ".06em", color: "var(--od-ink3)" }}>
              {right}
            </span>
          )
        )}
      </div>
      {chips && (
        <div className="noscroll" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10 }}>
          {[{ key: "all", label: "All" }, ...chips].map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setSub(c.key)}
              style={{
                flex: "none",
                height: 30,
                padding: "0 12px",
                borderRadius: 999,
                border: `1px solid ${sub === c.key ? "var(--od-ink)" : "var(--od-line)"}`,
                background: sub === c.key ? "var(--od-ink)" : "transparent",
                color: sub === c.key ? "var(--od-bg)" : "var(--od-ink2)",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      <div className="od-qrow head">
        <span>QUESTION</span>
        <span className="desk">30D</span>
        <span style={{ textAlign: "end" }}>YES</span>
        <span className="desk">24H</span>
        <span className="desk">VOL 24H</span>
        <span className="desk">CLOSES</span>
        <span className="desk" />
      </div>
      {shown.map((m) => (
        <Link key={m.id} href={`/market/${m.slug}`} className="od-qrow">
          <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3, color: "var(--od-ink)" }}>{m.q}</span>
            <span className="mono" style={{ fontWeight: 500, fontSize: 11, color: "var(--od-ink3)" }}>
              {[showSub ? m.subName : "", m.codes].filter(Boolean).join(" · ")}
            </span>
          </span>
          <svg className="desk" viewBox="0 0 64 20" style={{ width: 64, height: 20, justifySelf: "end" }} aria-hidden>
            <path d={m.sp} style={{ fill: "none", stroke: chgCol(m.chg), strokeWidth: 1.5 }} />
          </svg>
          <span style={{ display: "grid", justifyItems: "end" }}>
            <b className="mono" style={{ fontWeight: 700, fontSize: 17, color: "var(--od-ink)" }}>
              {pct(m.p)}%
            </b>
            <span className="mob mono" style={{ fontWeight: 700, fontSize: 11, color: chgCol(m.chg) }}>
              {chg(m.chg)}
            </span>
          </span>
          <span className="desk mono" style={{ fontWeight: 700, fontSize: 12.5, color: chgCol(m.chg) }}>
            {chg(m.chg)}
          </span>
          <span className="desk mono" style={{ fontWeight: 500, fontSize: 12.5, color: "var(--od-ink2)" }}>
            {fmtV(m.vol)}
          </span>
          <span className="desk mono" style={{ fontWeight: 500, fontSize: 12.5, color: "var(--od-ink2)", textAlign: "end" }}>
            {m.close ?? "—"}
          </span>
          <span className="desk" style={{ justifySelf: "end", height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid var(--od-line)", fontSize: 12.5, fontWeight: 700, color: "var(--od-ink)", alignItems: "center" }}>
            Trade
          </span>
        </Link>
      ))}
      {all.length > shown.length && (
        <button
          type="button"
          onClick={() => setMore(true)}
          style={{ marginTop: 12, height: 40, padding: "0 16px", borderRadius: 10, border: "1px solid var(--od-line)", background: "transparent", color: "var(--od-ink)", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
        >
          Show all {all.length}
        </button>
      )}
    </div>
  );
}
