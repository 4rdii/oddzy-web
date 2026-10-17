import Link from "next/link";
import { chg, chgCol, pct, sparkPath } from "@/lib/od";

/**
 * Small server-renderable pieces of the redesign: the sparkline, the family
 * card (OdFamily: a deadline ladder or an outcome race) and section headers.
 */

export function Spark({ h, d, w = 64, ht = 20, style }: { h: number[]; d: number | null; w?: number; ht?: number; style?: React.CSSProperties }) {
  return (
    <svg viewBox={`0 0 ${w} ${ht}`} style={{ width: w, height: ht, ...style }} aria-hidden>
      <path d={sparkPath(h, w, ht)} style={{ fill: "none", stroke: chgCol(d), strokeWidth: 1.5 }} />
    </svg>
  );
}

export function SecHead({ title, right, as = "h2", size = 28, style }: { title: React.ReactNode; right?: React.ReactNode; as?: "h2" | "h3"; size?: number; style?: React.CSSProperties }) {
  const H = as;
  return (
    <div className="sechead" style={style}>
      <H style={{ margin: 0, font: `500 ${size}px/1.1 var(--od-serif)` }}>{title}</H>
      {right !== undefined && (
        <span className="mono" style={{ fontWeight: 600, fontSize: 11, letterSpacing: ".06em", color: "var(--od-ink3)" }}>
          {right}
        </span>
      )}
    </div>
  );
}

export type FamStop = { id: string; slug: string; lab: string; p: number; chg: number | null; url: string; vol: number };
export type FamView = { key: string; t: "ladder" | "race"; title: string; stops: FamStop[]; n: number };

/** OdFamily: a ladder (timeline of deadlines) or a race (outcomes with bars). */
export function OdFamily({ f, current, style }: { f: FamView; current?: string; style?: React.CSSProperties }) {
  const ms = f.stops;
  const y = (p: number) => 6 + ((100 - p) / 100) * 44;
  const max = Math.max(...ms.map((m) => m.p));
  const meta = f.t === "ladder" ? `${ms.length} DEADLINES` : `${f.n} OUTCOMES`;
  const path = ms.map((m, i) => `${i ? "L" : "M"}${(((i + 0.5) / ms.length) * 300).toFixed(1)} ${y(m.p).toFixed(1)}`).join(" ");
  return (
    <div style={{ background: "var(--od-panel)", border: "1px solid var(--od-line)", borderRadius: 14, padding: 16, display: "grid", gap: 12, minWidth: 0, alignContent: "start", ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--od-ink)", minWidth: 0 }}>{f.title}</span>
        <span className="meta" style={{ whiteSpace: "nowrap" }}>
          {meta}
        </span>
      </div>
      {f.t === "ladder" ? (
        <>
          <div style={{ position: "relative", height: 56 }}>
            <svg viewBox="0 0 300 56" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: 56, overflow: "visible" }} aria-hidden>
              <line x1="0" y1="50" x2="300" y2="50" style={{ stroke: "var(--od-line)", strokeWidth: 1 }} vectorEffect="non-scaling-stroke" />
              <path d={path} style={{ fill: "none", stroke: "var(--od-brand)", strokeWidth: 2 }} vectorEffect="non-scaling-stroke" />
            </svg>
            {ms.map((m, i) => (
              <span
                key={m.id}
                style={{
                  position: "absolute",
                  left: `${(((i + 0.5) / ms.length) * 100).toFixed(2)}%`,
                  top: `${y(m.p).toFixed(1)}px`,
                  width: 11,
                  height: 11,
                  margin: "-5.5px 0 0 -5.5px",
                  borderRadius: "50%",
                  background: "var(--od-panel)",
                  border: `2.5px solid ${m.id === current ? "var(--od-ink)" : "var(--od-brand)"}`,
                }}
              />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${ms.length},minmax(0,1fr))`, gap: 8 }}>
            {ms.map((m) => (
              <Link
                key={m.id}
                href={m.url}
                style={{
                  display: "grid",
                  justifyItems: "center",
                  gap: 2,
                  padding: "8px 4px",
                  borderRadius: 10,
                  background: m.id === current ? "var(--od-panel2)" : "var(--od-chip)",
                  textAlign: "center",
                  outline: m.id === current ? "1.5px solid var(--od-brand)" : "none",
                }}
              >
                <span className="mono" style={{ fontWeight: 500, fontSize: 11.5, color: "var(--od-ink3)" }}>
                  {m.lab}
                </span>
                <span className="mono" style={{ fontWeight: 700, fontSize: 24, lineHeight: 1.1, letterSpacing: "-.03em", color: "var(--od-ink)" }}>
                  {pct(m.p)}%
                </span>
                <span className="mono" style={{ fontWeight: 700, fontSize: 11.5, color: chgCol(m.chg) }}>
                  {chg(m.chg)}
                </span>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div style={{ display: "grid", gap: 4 }}>
          {ms.map((m) => (
            <Link
              key={m.id}
              href={m.url}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) 54px 40px",
                gap: 10,
                alignItems: "center",
                padding: "6px 8px",
                borderRadius: 9,
                background: m.id === current ? "var(--od-panel2)" : "transparent",
              }}
            >
              <span style={{ display: "grid", gap: 5, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--od-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.lab}</span>
                <span style={{ height: 6, borderRadius: 3, background: "var(--od-line2)" }}>
                  <span style={{ display: "block", height: 6, borderRadius: 3, width: `${m.p}%`, background: m.p === max ? "var(--od-brand)" : "var(--od-ink3)" }} />
                </span>
              </span>
              <b className="mono" style={{ fontWeight: 700, fontSize: 17, textAlign: "end", color: "var(--od-ink)" }}>
                {pct(m.p)}%
              </b>
              <span className="mono" style={{ fontWeight: 700, fontSize: 11.5, textAlign: "end", color: chgCol(m.chg) }}>
                {chg(m.chg)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** The dark "Trade →" button used on lead cards. */
export function TradeBtn({ href, h = 42 }: { href: string; h?: number }) {
  return (
    <Link
      href={href}
      style={{
        flex: "none",
        height: h,
        padding: "0 18px",
        borderRadius: 10,
        background: "var(--od-ink)",
        color: "var(--od-bg)",
        fontWeight: 700,
        fontSize: 14.5,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      Trade<span aria-hidden>→</span>
    </Link>
  );
}

/** "Trade on Oddzy" deep link into the web app with the market (and side) preselected. */
export function appTradeUrl(slug: string, side?: "yes" | "no", amount?: number): string {
  const q = new URLSearchParams({ market: slug });
  if (side) q.set("side", side);
  if (amount) q.set("amount", String(amount));
  return `/app?${q}`;
}
