"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import type { MiniMarket } from "@/lib/desk";
import { chg, chgCol, fmtV, pct } from "@/lib/od";
import { appTradeUrl } from "./parts";

/**
 * The question page's client islands: the trade box (side panel ≥980px, a
 * bottom bar below), and the live extras fetched from /api/od/related
 * (countries, In the news, Related questions).
 */

type Related = {
  countries: { code: string; name: string }[];
  news: { k: string; q: string; s: string; src: string; ago: string; url: string }[];
  related: MiniMarket[];
};

const Ctx = createContext<Related | null | undefined>(undefined);

export function RelatedProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [data, setData] = useState<Related | null | undefined>(undefined);
  useEffect(() => {
    fetch(`/api/od/related?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, [slug]);
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

export function CountryChips() {
  const d = useContext(Ctx);
  if (!d?.countries.length) return <div style={{ minHeight: 28 }} />;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {d.countries.map((c) => (
        <span key={c.code} style={{ height: 28, padding: "0 10px", borderRadius: 999, border: "1px solid var(--od-line)", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <span className="mono" style={{ fontWeight: 600, fontSize: 10.5, color: "var(--od-ink3)" }}>
            {c.code}
          </span>
          {c.name}
        </span>
      ))}
    </div>
  );
}

export function InTheNews() {
  const d = useContext(Ctx);
  return (
    <div>
      <div className="sechead" style={{ marginBottom: 4 }}>
        <h2 style={{ fontSize: 24 }}>In the news</h2>
      </div>
      {d === undefined && <div style={{ height: 60 }} />}
      {d !== undefined && !d?.news.length && <p style={{ fontSize: 14, color: "var(--od-ink3)" }}>No linked stories in the last 24 hours.</p>}
      {d?.news.map((n) => (
        <div key={n.k} className="od-q-news">
          <span className="mono" style={{ fontWeight: 600, fontSize: 11, lineHeight: 1.7, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--od-ink3)" }}>
            {n.src} · {n.ago}
          </span>
          <span style={{ display: "grid", gap: 4 }}>
            <a href={n.url} target="_blank" rel="noopener nofollow" className="serif" style={{ fontWeight: 500, fontSize: 19, lineHeight: 1.28 }}>
              {n.q}
            </a>
            {n.s && <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--od-ink2)" }}>{n.s}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RelatedQuestions() {
  const d = useContext(Ctx);
  if (!d?.related.length) return null;
  return (
    <div>
      <div className="sechead" style={{ marginBottom: 4 }}>
        <h2 style={{ fontSize: 24 }}>Related questions</h2>
      </div>
      {d.related.map((r) => (
        <Link key={r.id} href={r.url} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 64px 56px", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--od-line2)" }}>
          <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3 }}>{r.q}</span>
            <span className="mono" style={{ fontWeight: 500, fontSize: 11, color: "var(--od-ink3)" }}>
              {fmtV(r.vol)} 24h{r.close ? ` · closes ${r.close}` : ""}
            </span>
          </span>
          <svg viewBox="0 0 64 20" style={{ width: 64, height: 20 }} aria-hidden>
            <path d={r.sp} style={{ fill: "none", stroke: chgCol(r.chg), strokeWidth: 1.5 }} />
          </svg>
          <span style={{ display: "grid", justifyItems: "end" }}>
            <b className="mono" style={{ fontWeight: 700, fontSize: 17 }}>
              {pct(r.p)}%
            </b>
            <span className="mono" style={{ fontWeight: 700, fontSize: 11, color: chgCol(r.chg) }}>
              {chg(r.chg)}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Yes/No + amount → shares and payout, then into the web app on this market. */
export function TradeBox({ slug, yes }: { slug: string; yes: number }) {
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [amt, setAmt] = useState(50);
  const yesC = Math.max(1, Math.min(99, Math.round(yes)));
  const noC = 100 - yesC;
  const price = side === "yes" ? yesC : noC;
  const shares = amt / (price / 100);
  const sideName = side === "yes" ? "Yes" : "No";
  const href = appTradeUrl(slug, side, amt);
  const btn = (s: "yes" | "no", h: number, inline?: boolean) => {
    const on = side === s;
    const col = s === "yes" ? "var(--od-up)" : "var(--od-down)";
    return (
      <button
        type="button"
        onClick={() => setSide(s)}
        style={{
          height: h,
          borderRadius: 12,
          cursor: "pointer",
          border: `1.5px solid ${on ? col : "var(--od-line)"}`,
          background: on ? (s === "yes" ? "var(--od-upBg)" : "var(--od-downBg)") : "transparent",
          color: "var(--od-ink)",
          display: inline ? "block" : "grid",
          placeContent: "center",
          gap: 2,
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {inline ? (
          <>
            {s === "yes" ? "Yes" : "No"} <span className="mono">{s === "yes" ? yesC : noC}¢</span>
          </>
        ) : (
          <>
            <span style={{ fontSize: 13, fontWeight: 700, color: col }}>{s === "yes" ? "Yes" : "No"}</span>
            <b className="mono" style={{ fontWeight: 700, fontSize: 22 }}>
              {s === "yes" ? yesC : noC}¢
            </b>
          </>
        )}
      </button>
    );
  };
  return (
    <>
      <aside className="od-q-side" style={{ position: "sticky", top: 110, background: "var(--od-panel)", border: "1px solid var(--od-line)", borderRadius: 18, padding: 18, gap: 14 }}>
        <div className="mono" style={{ fontWeight: 600, fontSize: 11, letterSpacing: ".07em", color: "var(--od-ink3)" }}>
          PLACE A TRADE
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {btn("yes", 64)}
          {btn("no", 64)}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 12.5, color: "var(--od-ink3)" }}>Amount</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
            {[10, 50, 100, 500].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmt(v)}
                className="mono"
                style={{ height: 38, borderRadius: 9, cursor: "pointer", border: `1px solid ${amt === v ? "var(--od-ink)" : "var(--od-line)"}`, background: amt === v ? "var(--od-panel2)" : "transparent", color: "var(--od-ink)", fontWeight: 700, fontSize: 13.5 }}
              >
                ${v}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gap: 6, padding: 12, borderRadius: 12, background: "var(--od-chip)", fontSize: 13.5 }}>
          <span style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--od-ink2)" }}>Shares</span>
            <b className="mono">{shares.toFixed(1)}</b>
          </span>
          <span style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--od-ink2)" }}>Pays if {sideName}</span>
            <b className="mono" style={{ color: "var(--od-up)" }}>
              ${shares.toFixed(2)}
            </b>
          </span>
        </div>
        <Link href={href} style={{ height: 50, borderRadius: 12, background: "var(--od-brand)", color: "var(--od-brandInk)", fontWeight: 800, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          Trade {sideName} on Oddzy →
        </Link>
        <span style={{ fontSize: 12, lineHeight: 1.5, color: "var(--od-ink3)" }}>
          Your order is placed directly on Polymarket, from your own wallet, in the Oddzy web app. Oddzy never holds your funds. Prices are Polymarket’s and can move before you confirm.
        </span>
      </aside>
      <div className="od-q-bar">
        {btn("yes", 50, true)}
        {btn("no", 50, true)}
        <Link href={href} style={{ height: 50, borderRadius: 12, background: "var(--od-brand)", color: "var(--od-brandInk)", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          Trade {sideName} →
        </Link>
      </div>
    </>
  );
}
