"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GlobeC, Lead, MiniMarket, NewsItem } from "@/lib/desk";
import { agoShort, chg, chgBg, chgCol, fmtV, pct, type SecKey } from "@/lib/od";
import { OdGlobe, type OdGlobeHandle } from "./OdGlobe";
import { BrowserMock, InstallCta, type FinderRow } from "./OdExtension";
import type { GlobeCountry } from "./odGlobe";

/**
 * The oddzy.xyz home (design: "Oddzy Home"): lead story, the globe with its
 * country / story card, Moving now, The wire, Hottest countries, The desks
 * and the Market Finder band. One client island because the globe, the card
 * and the lists all share the selection.
 */

export type DeskCard = { key: SecKey; name: string; url: string; count: number; vol: number; top: { q: string; p: number; url: string }[] };

const SEC_NAME: Record<SecKey, string> = { war: "War & Geopolitics", pol: "Politics", eco: "Economy" };
const REGS: [string, string][] = [
  ["all", "Whole world"],
  ["me", "Middle East"],
  ["eu", "Europe & Russia"],
  ["am", "Americas"],
  ["as", "Asia"],
  ["af", "Africa"],
];
/** Region membership for the wire filter (the globe works it out from geometry). */
const REG_IDS: Record<string, string[]> = {
  me: ["364", "376", "422", "760", "368", "682", "887", "792", "818", "634", "784", "512", "400", "275", "414", "048"],
  eu: ["643", "804", "276", "250", "826", "616", "348", "642", "498", "112", "268", "051", "031", "380", "724", "752", "528", "688", "300"],
  am: ["840", "124", "484", "862", "076", "032", "170", "192", "304", "152", "604", "218"],
  as: ["156", "158", "408", "410", "392", "586", "356", "004", "608", "036", "764", "704", "360"],
  af: ["729", "231", "706", "434", "566", "180", "818", "710", "404", "012"],
};

export function OdHome({
  renderedAt,
  dateLine,
  totals,
  lead,
  countries,
  news,
  movers,
  desks,
  finder,
}: {
  /** Server render time: relative times agree between server and client. */
  renderedAt: number;
  dateLine: string;
  totals: { vol: string; countries: number; markets: string };
  lead: Lead | null;
  countries: GlobeC[];
  news: NewsItem[];
  movers: MiniMarket[];
  desks: DeskCard[];
  finder: FinderRow[];
}) {
  const [metric, setMetric] = useState<"vol" | "risk">("vol");
  const [region, setRegion] = useState("all");
  const [hover, setHover] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [openNews, setOpenNews] = useState<string | null>(null);
  const [phone, setPhone] = useState(false);
  const globe = useRef<OdGlobeHandle>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = matchMedia("(max-width: 759px)");
    const f = () => setPhone(q.matches);
    f();
    q.addEventListener("change", f);
    return () => q.removeEventListener("change", f);
  }, []);

  const byId = useMemo(() => new Map(countries.map((c) => [c.id, c])), [countries]);
  const globeList = useMemo<GlobeCountry[]>(() => countries.map((c) => ({ id: c.id, name: c.name, v: c.v, r: c.r, links: c.links })), [countries]);
  const mv = useCallback((c: GlobeC) => (metric === "vol" ? c.v : c.r), [metric]);
  const sorted = useMemo(() => [...countries].sort((a, b) => mv(b) - mv(a)), [countries, mv]);

  /** Zoom by k; 0 resets the view. */
  function onZoom(k: number) {
    if (k) globe.current?.zoomBy(k);
    else {
      setSel(null);
      setOpenNews(null);
      setRegion("all");
    }
  }

  const toGlobe = () => {
    const el = box.current;
    if (!el) return;
    const t = el.getBoundingClientRect().top;
    if (t < 80 || t > innerHeight * 0.5) window.scrollTo({ top: t + scrollY - 110, behavior: "smooth" });
  };
  const pickCountry = (id: string) => {
    setSel(id);
    setOpenNews(null);
    toGlobe();
  };
  const toggleNews = (k: string) => {
    setOpenNews((cur) => (cur === k ? null : k));
    setSel(null);
    toGlobe();
  };

  const N = openNews ? news.find((n) => n.k === openNews) ?? null : null;
  const cid = sel ?? hover ?? (byId.has("364") ? "364" : sorted[0]?.id);
  const c = cid ? byId.get(cid) : undefined;
  const focus = N ? N.ids.filter((id) => byId.has(id)) : sel && c ? [sel, ...c.links.slice(0, 5)] : [];

  const card = N ? (
    <CountryCard
      kicker={`${N.src} · ${N.ago}`}
      title={N.q}
      titleSize={17}
      summary={N.s}
      markets={N.mk}
      link={N.url}
      linkLabel="Read the story →"
      external
      onClose={() => setOpenNews(null)}
    />
  ) : c ? (
    <CountryCard
      kicker={`#${sorted.indexOf(c) + 1} ${metric === "vol" ? "by volume" : "by conflict risk"}`}
      title={c.name}
      stats={[
        ["24h volume", fmtV(c.v)],
        ["Markets", String(c.n)],
        ["Conflict risk", `${c.r}%`],
      ]}
      markets={c.mk}
      link={c.url ?? undefined}
      linkLabel={`All ${c.name} markets →`}
      hint={sel ? "" : phone ? "Tap a country to pin it" : "Hover a country · click to pin"}
      onClose={sel ? () => setSel(null) : undefined}
    />
  ) : null;

  const inReg = (ids: string[]) => region === "all" || ids.some((id) => REG_IDS[region]?.includes(id));
  const wire = news.filter((n) => inReg(n.ids));
  const top = sorted[0] ? mv(sorted[0]) || 1 : 1;
  const risk = metric === "risk";

  return (
    <div className="od-main">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "8px 24px", padding: "18px 0 16px", borderBottom: "1px solid var(--od-line2)" }}>
        <h1 className="mono" style={{ margin: 0, fontWeight: 600, fontSize: 12, lineHeight: 1.2, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--od-ink3)" }}>
          {dateLine} · What the world is betting on
        </h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px", fontSize: 13, color: "var(--od-ink3)" }}>
          {(
            [
              [totals.vol, "24h volume"],
              [String(totals.countries), "countries"],
              [totals.markets, "live markets"],
            ] as const
          ).map(([v, k]) => (
            <span key={k} style={{ whiteSpace: "nowrap" }}>
              <b className="mono" style={{ fontWeight: 700, fontSize: 13, color: "var(--od-ink)" }}>
                {v}
              </b>{" "}
              {k}
            </span>
          ))}
        </div>
      </div>

      <section aria-label="Today" className="od-hero">
        {lead && (
          <article style={{ borderTop: "3px solid var(--od-ink)", paddingTop: 14, display: "grid", gap: 18, minWidth: 0 }}>
            <div className="mono" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 11, lineHeight: 1, letterSpacing: ".08em", textTransform: "uppercase" }}>
              <span style={{ color: "var(--od-down)" }}>● Lead story</span>
              <span style={{ color: "var(--od-ink3)" }}>
                {lead.secName} · {lead.subName}
              </span>
            </div>
            <h2 className="serif" style={{ margin: 0, fontWeight: 500, fontSize: "clamp(28px,2.6vw,38px)", lineHeight: 1.1, letterSpacing: "-.012em", textWrap: "pretty" }}>
              {lead.head}
            </h2>
            {lead.news.length > 1 && (
              <div style={{ display: "grid", gap: 6 }}>
                {lead.news.slice(1).map((n) => (
                  <span key={n.k} style={{ display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.4, color: "var(--od-ink2)" }}>
                    <span className="mono" style={{ flex: "none", fontWeight: 600, fontSize: 11, lineHeight: 1.6, color: "var(--od-ink3)", width: 80 }}>
                      {n.src}
                    </span>
                    <span>{n.q}</span>
                  </span>
                ))}
              </div>
            )}
            <LeadCard lead={lead} />
            {lead.ids.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12.5, color: "var(--od-ink3)", marginInlineEnd: 4 }}>Countries involved</span>
                {lead.ids
                  .map((id) => byId.get(id))
                  .filter((x): x is GlobeC => !!x)
                  .map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      onClick={() => pickCountry(x.id)}
                      style={{ height: 30, padding: "0 11px", borderRadius: 999, border: "1px solid var(--od-line)", background: "transparent", color: "var(--od-ink)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <span className="mono" style={{ fontWeight: 600, fontSize: 10.5, color: "var(--od-ink3)" }}>
                        {x.code}
                      </span>
                      {x.name}
                    </button>
                  ))}
              </div>
            )}
          </article>
        )}

        <div style={{ minWidth: 0, display: "grid", gap: 12 }}>
          <div ref={box} id="globe" className="od-globebox">
            <OdGlobe ref={globe} countries={globeList} metric={metric} region={region} focus={focus} onHover={setHover} onSelect={(id) => (id ? pickCountry(id) : setSel(null))} />
            <div style={{ position: "absolute", insetInline: 14, top: 14, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", pointerEvents: "none" }}>
              <div style={{ display: "flex", padding: 3, borderRadius: 10, background: "var(--od-glass)", border: "1px solid var(--od-line)", pointerEvents: "auto", backdropFilter: "blur(8px)" }}>
                {(
                  [
                    ["vol", "Money bet"],
                    ["risk", "Conflict risk"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMetric(k)}
                    style={{ height: 30, padding: "0 12px", border: 0, borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", background: metric === k ? "var(--od-ink)" : "transparent", color: metric === k ? "var(--od-bg)" : "var(--od-ink2)" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="noscroll" style={{ display: "flex", gap: 6, overflowX: "auto", pointerEvents: "auto", maxWidth: "100%" }}>
                {REGS.map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setRegion(k);
                      setSel(null);
                      setOpenNews(null);
                    }}
                    style={{
                      flex: "none",
                      height: 30,
                      padding: "0 11px",
                      borderRadius: 999,
                      border: `1px solid ${region === k ? "var(--od-ink)" : "var(--od-line)"}`,
                      background: region === k ? "var(--od-ink)" : "var(--od-glass)",
                      color: region === k ? "var(--od-bg)" : "var(--od-ink2)",
                      fontSize: 12.5,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ position: "absolute", insetInlineEnd: 14, bottom: 14, display: "grid", gap: 6 }}>
              {(
                [
                  ["+", "Zoom in", 1.5],
                  ["−", "Zoom out", 1 / 1.5],
                  ["⟲", "Reset view", 0],
                ] as const
              ).map(([t, label, k]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onZoom(k)}
                  aria-label={label}
                  style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--od-line)", background: "var(--od-glass)", color: t === "⟲" ? "var(--od-ink2)" : "var(--od-ink)", fontSize: t === "⟲" ? 14 : 17, cursor: "pointer" }}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="od-card-overlay" style={{ position: "absolute", insetInlineStart: 14, bottom: 14, width: "min(330px, calc(100% - 76px))" }}>
              {card}
            </div>
            <div className="od-legend mono" style={{ position: "absolute", insetInlineEnd: 62, bottom: 18, gap: 8, alignItems: "center", fontWeight: 500, fontSize: 10.5, color: "var(--od-ink3)" }}>
              <span>{risk ? "Calm" : "Less $"}</span>
              <span style={{ width: 70, height: 6, borderRadius: 3, background: risk ? "linear-gradient(90deg,rgba(255,107,107,.15),rgb(255,107,107))" : "linear-gradient(90deg,rgba(34,197,139,.15),rgb(34,197,139))" }} />
              <span>{risk ? "Tense" : "More $"}</span>
            </div>
          </div>
          <div className="od-card-below">{card}</div>
        </div>

        <aside aria-label="Moving now" className="od-movers" style={{ minWidth: 0, display: "grid", gap: 10, alignContent: "start" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "3px solid var(--od-ink)", paddingTop: 14 }}>
            <h2 className="serif" style={{ margin: 0, fontWeight: 500, fontSize: 24, lineHeight: 1.1 }}>
              Moving now
            </h2>
            <span className="mono" style={{ fontWeight: 600, fontSize: 11, letterSpacing: ".06em", color: "var(--od-ink3)" }}>
              24H CHANGE
            </span>
          </div>
          <div className="od-movers-list noscroll">
            {movers.map((m) => (
              <Link
                key={m.id}
                href={m.url}
                style={{ display: "grid", gridTemplateColumns: "52px minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "11px 12px", borderRadius: 12, background: "var(--od-panel)", border: "1px solid var(--od-line2)" }}
              >
                <span className="mono" style={{ fontWeight: 700, fontSize: 14, lineHeight: 1, color: chgCol(m.chg), background: chgBg(m.chg), borderRadius: 7, padding: "7px 0", textAlign: "center" }}>
                  {chg(m.chg)}
                </span>
                <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
                  <span className="clamp2" style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, color: "var(--od-ink)" }}>
                    {m.q}
                  </span>
                  <span className="mono" style={{ fontWeight: 500, fontSize: 10.5, color: "var(--od-ink3)" }}>
                    {m.codes ? `${m.codes} · ` : ""}
                    {fmtV(m.vol)}
                  </span>
                </span>
                <span style={{ display: "grid", justifyItems: "end", gap: 2 }}>
                  <span className="mono" style={{ fontWeight: 700, fontSize: 17, lineHeight: 1, color: "var(--od-ink)" }}>
                    {pct(m.p)}%
                  </span>
                  <svg viewBox="0 0 64 20" style={{ width: 48, height: 15 }} aria-hidden>
                    <path d={m.sp} style={{ fill: "none", stroke: chgCol(m.chg), strokeWidth: 1.5 }} />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <section id="wire" className="od-lower">
        <div style={{ minWidth: 0 }}>
          <div className="sechead" style={{ marginBottom: 6 }}>
            <h2>The wire</h2>
            <span style={{ fontSize: 13, color: "var(--od-ink3)" }}>{region === "all" ? "Al Jazeera and BBC, linked to live markets" : `Filtered to ${REGS.find((r) => r[0] === region)?.[1]}`}</span>
          </div>
          {wire.length === 0 && <p style={{ fontSize: 14, color: "var(--od-ink3)", padding: "16px 0" }}>No stories from this region in the last day.</p>}
          {wire.map((n) => {
            const isOpen = openNews === n.k;
            return (
              <div key={n.k} className="od-wire-row" style={{ background: isOpen ? "var(--od-panel2)" : "transparent" }}>
                <span className="mono" style={{ fontWeight: 600, fontSize: 12, lineHeight: 1.6, color: "var(--od-ink3)" }} suppressHydrationWarning>
                  {agoShort(n.at, renderedAt)}
                </span>
                <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--od-ink3)" }}>
                    {n.src} · {SEC_NAME[n.sec]}
                  </span>
                  <button type="button" onClick={() => toggleNews(n.k)} className="serif" style={{ all: "unset", cursor: "pointer", fontFamily: "var(--od-serif)", fontWeight: 500, fontSize: 20, lineHeight: 1.25, color: "var(--od-ink)", textWrap: "pretty" }}>
                    {n.q}
                  </button>
                  <span style={{ fontSize: 13, color: "var(--od-ink3)" }}>
                    {[n.countries, n.count ? `${n.count} market${n.count > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ")}
                  </span>
                  {isOpen && (
                    <>
                      <p style={{ margin: "2px 0 4px", fontSize: 14.5, lineHeight: 1.55, color: "var(--od-ink2)", maxWidth: "62ch" }}>{n.s}</p>
                      <a href={n.url} target="_blank" rel="noopener nofollow" style={{ fontSize: 13, fontWeight: 700, color: "var(--od-brand)" }}>
                        Read on {n.src} ↗
                      </a>
                    </>
                  )}
                </div>
                {n.m && (
                  <Link href={n.m.url} className="od-pill" style={{ alignSelf: "start", display: "grid", gap: 4, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--od-line)", background: "var(--od-panel)", minWidth: 0 }}>
                    <span className="clamp2" style={{ fontSize: 12.5, lineHeight: 1.3, color: "var(--od-ink2)" }}>
                      {n.m.q}
                    </span>
                    <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <b className="mono" style={{ fontWeight: 700, fontSize: 18, color: "var(--od-ink)" }}>
                        {pct(n.m.p)}%
                      </b>
                      <span className="mono" style={{ fontWeight: 700, fontSize: 12, color: chgCol(n.m.chg) }}>
                        {chg(n.m.chg)}
                      </span>
                      <span style={{ marginInlineStart: "auto", fontSize: 12.5, fontWeight: 700, color: "var(--od-brand)" }}>Trade →</span>
                    </span>
                  </Link>
                )}
              </div>
            );
          })}
          <Link href="/extension" style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 0", fontSize: 13.5, fontWeight: 600, color: "var(--od-ink2)", flexWrap: "wrap" }}>
            <span style={{ width: 18, height: 18, borderRadius: 5, background: "linear-gradient(140deg,#2fe0a0,#0c9f8e)", flex: "none" }} />
            See markets for any article →<span style={{ fontWeight: 400, color: "var(--od-ink3)" }}>Market Finder for Chrome</span>
          </Link>
        </div>

        <div style={{ minWidth: 0, display: "grid", gap: 40 }}>
          <div>
            <div className="sechead" style={{ marginBottom: 10 }}>
              <h2>Hottest countries</h2>
              <span className="mono" style={{ fontWeight: 600, fontSize: 11, letterSpacing: ".06em", color: "var(--od-ink3)" }}>
                {risk ? "CONFLICT RISK" : "24H VOLUME"}
              </span>
            </div>
            <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {sorted.slice(0, 10).map((x, i) => (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => pickCountry(x.id)}
                    style={{ all: "unset", boxSizing: "border-box", width: "100%", cursor: "pointer", display: "grid", gridTemplateColumns: "26px minmax(0,1fr) 72px 40px", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--od-line2)" }}
                  >
                    <span className="mono" style={{ fontWeight: 600, fontSize: 12, color: "var(--od-ink3)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span style={{ display: "grid", gap: 5, minWidth: 0 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--od-ink)" }}>{x.name}</span>
                      <span style={{ height: 4, borderRadius: 2, background: "var(--od-line2)" }}>
                        <span style={{ display: "block", height: 4, borderRadius: 2, width: `${((mv(x) / top) * 100).toFixed(1)}%`, background: risk ? "var(--od-down)" : "var(--od-brand)" }} />
                      </span>
                    </span>
                    <span className="mono" style={{ fontWeight: 700, fontSize: 14, textAlign: "end", color: "var(--od-ink)" }}>
                      {risk ? `${x.r}%` : fmtV(x.v)}
                    </span>
                    <span className="mono" style={{ fontWeight: 500, fontSize: 11.5, textAlign: "end", color: "var(--od-ink3)" }}>
                      {x.n}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--od-ink3)" }}>Last column: live markets. Tap a country to light it up on the globe.</p>
          </div>
          <div>
            <div className="sechead" style={{ marginBottom: 12 }}>
              <h2>The desks</h2>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {desks.map((d) => (
                <Link key={d.key} href={d.url} style={{ display: "grid", gap: 10, padding: 16, borderRadius: 14, background: "var(--od-panel)", border: "1px solid var(--od-line2)" }}>
                  <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <span className="serif" style={{ fontWeight: 500, fontSize: 22, lineHeight: 1.1, color: "var(--od-ink)" }}>
                      {d.name}
                    </span>
                    <span className="mono" style={{ fontWeight: 500, fontSize: 11.5, color: "var(--od-ink3)" }}>
                      {d.count} markets · {fmtV(d.vol)}
                    </span>
                  </span>
                  {d.top.map((m) => (
                    <span key={m.url} style={{ display: "flex", gap: 12, alignItems: "baseline", fontSize: 13.5, color: "var(--od-ink2)" }}>
                      <span style={{ flex: 1, minWidth: 0 }}>{m.q}</span>
                      <b className="mono" style={{ fontWeight: 700, fontSize: 14, color: "var(--od-ink)" }}>
                        {pct(m.p)}%
                      </b>
                    </span>
                  ))}
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--od-brand)" }}>Open {d.name} →</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Market Finder extension" className="od-ext-band" style={{ marginTop: 56, padding: "clamp(20px,3vw,32px)", borderRadius: 18, border: "1px solid var(--od-line)", background: "var(--od-panel)", gap: "clamp(20px,3vw,40px)", alignItems: "center", overflow: "hidden" }}>
        <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
          <span className="kicker">Market Finder · Browser extension</span>
          <h2 className="serif" style={{ margin: 0, fontWeight: 500, fontSize: "clamp(26px,2.6vw,36px)", lineHeight: 1.08, letterSpacing: "-.01em", textWrap: "pretty" }}>
            You read the news. Oddzy tells you what the market thinks will happen next.
          </h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "var(--od-ink2)", maxWidth: "44ch" }}>Click it on any article to see the markets that answer the story, with live odds.</p>
          <InstallCta after="page" />
        </div>
        <div style={{ minWidth: 0 }}>
          <BrowserMock rows={finder} height={560} />
        </div>
      </section>
    </div>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  const f = lead.fam;
  const k = lead.key;
  const y = (p: number) => 6 + ((100 - p) / 100) * 44;
  const s = k.spark.length >= 2 ? k.spark : [k.p, k.p];
  const yy = (v: number) => 40 - (v / 100) * 40;
  const line = s.map((v, i) => `${i ? "L" : "M"}${((i / (s.length - 1)) * 320).toFixed(1)} ${yy(v).toFixed(1)}`).join(" ");
  return (
    <div style={{ background: "var(--od-panel)", border: "1px solid var(--od-line)", borderRadius: 14, padding: "16px 16px 14px", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{f ? f.title : k.q}</span>
        <span className="meta" style={{ whiteSpace: "nowrap" }}>
          {f ? (f.t === "ladder" ? "TIMELINE" : "THE RACE") : `${pct(k.p)}%`}
        </span>
      </div>
      {f && f.t === "ladder" && (
        <>
          <div style={{ position: "relative", height: 56 }}>
            <svg viewBox="0 0 300 56" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: 56, overflow: "visible" }} aria-hidden>
              <line x1="0" y1="50" x2="300" y2="50" style={{ stroke: "var(--od-line)", strokeWidth: 1 }} vectorEffect="non-scaling-stroke" />
              <path d={f.stops.map((m, i) => `${i ? "L" : "M"}${(((i + 0.5) / f.stops.length) * 300).toFixed(1)} ${y(m.p).toFixed(1)}`).join(" ")} style={{ fill: "none", stroke: "var(--od-brand)", strokeWidth: 2 }} vectorEffect="non-scaling-stroke" />
            </svg>
            {f.stops.map((m, i) => (
              <span key={m.id} style={{ position: "absolute", left: `${(((i + 0.5) / f.stops.length) * 100).toFixed(2)}%`, top: `${y(m.p).toFixed(1)}px`, width: 11, height: 11, margin: "-5.5px 0 0 -5.5px", borderRadius: "50%", background: "var(--od-panel)", border: "2.5px solid var(--od-brand)" }} />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${f.stops.length},minmax(0,1fr))`, gap: 8 }}>
            {f.stops.map((m) => (
              <Link key={m.id} href={m.url} style={{ display: "grid", justifyItems: "center", gap: 2, padding: "8px 4px", borderRadius: 10, background: "var(--od-chip)", textAlign: "center" }}>
                <span className="mono" style={{ fontWeight: 500, fontSize: 11.5, color: "var(--od-ink3)" }}>
                  {m.lab}
                </span>
                <span className="mono" style={{ fontWeight: 700, fontSize: f.stops.length > 3 ? 22 : 26, lineHeight: 1.1, letterSpacing: "-.03em", color: "var(--od-ink)" }}>
                  {pct(m.p)}%
                </span>
                <span className="mono" style={{ fontWeight: 700, fontSize: 11.5, color: chgCol(m.chg) }}>
                  {chg(m.chg)} today
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
      {f && f.t === "race" && (
        <div style={{ display: "grid", gap: 4 }}>
          {f.stops.slice(0, 4).map((m, i) => (
            <Link key={m.id} href={m.url} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 54px 40px", gap: 10, alignItems: "center", padding: "6px 0" }}>
              <span style={{ display: "grid", gap: 5, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{m.lab}</span>
                <span style={{ height: 6, borderRadius: 3, background: "var(--od-line2)" }}>
                  <span style={{ display: "block", height: 6, borderRadius: 3, width: `${m.p}%`, background: i === 0 ? "var(--od-brand)" : "var(--od-ink3)" }} />
                </span>
              </span>
              <b className="mono" style={{ fontWeight: 700, fontSize: 17, textAlign: "end" }}>
                {pct(m.p)}%
              </b>
              <span className="mono" style={{ fontWeight: 700, fontSize: 11.5, textAlign: "end", color: chgCol(m.chg) }}>
                {chg(m.chg)}
              </span>
            </Link>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4, borderTop: "1px solid var(--od-line2)" }}>
        <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
          <span className="meta">
            {(k.close ?? "").toUpperCase()}
            {k.close ? " · " : ""}
            {s.length} DAYS · {fmtV(k.vol)} 24h
          </span>
          <svg viewBox="0 0 320 40" preserveAspectRatio="none" style={{ width: "100%", height: 36 }} aria-hidden>
            <path d={`${line} L320 40 L0 40 Z`} style={{ fill: "var(--od-brand)", fillOpacity: 0.12 }} />
            <path d={line} style={{ fill: "none", stroke: "var(--od-brand)", strokeWidth: 1.6 }} vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        <Link href={k.url} style={{ flex: "none", height: 42, padding: "0 18px", borderRadius: 10, background: "var(--od-ink)", color: "var(--od-bg)", fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", gap: 6 }}>
          Trade<span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}

function CountryCard({
  kicker,
  title,
  titleSize = 24,
  stats,
  summary,
  markets,
  link,
  linkLabel,
  external,
  hint,
  onClose,
}: {
  kicker: string;
  title: string;
  titleSize?: number;
  stats?: [string, string][];
  summary?: string;
  markets: MiniMarket[];
  link?: string;
  linkLabel: string;
  external?: boolean;
  hint?: string;
  onClose?: () => void;
}) {
  return (
    <div style={{ background: "var(--od-glass)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid var(--od-line)", borderRadius: 14, padding: 14, display: "grid", gap: 10, boxShadow: "0 10px 30px rgba(0,0,0,.18)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 3 }}>
          <span className="mono" style={{ fontWeight: 600, fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--od-ink3)" }}>
            {kicker}
          </span>
          <span className="serif" style={{ fontWeight: 500, fontSize: titleSize, lineHeight: 1.2, color: "var(--od-ink)" }}>
            {title}
          </span>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" style={{ flex: "none", width: 28, height: 28, borderRadius: 8, border: "1px solid var(--od-line)", background: "transparent", color: "var(--od-ink2)", cursor: "pointer", fontSize: 14 }}>
            ✕
          </button>
        )}
      </div>
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 6 }}>
          {stats.map(([k, v]) => (
            <div key={k} style={{ display: "grid", gap: 2, padding: "7px 9px", borderRadius: 9, background: "var(--od-chip)" }}>
              <span style={{ fontSize: 11, color: "var(--od-ink3)" }}>{k}</span>
              <b className="mono" style={{ fontWeight: 700, fontSize: 15, color: "var(--od-ink)" }}>
                {v}
              </b>
            </div>
          ))}
        </div>
      )}
      {summary && <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--od-ink2)" }}>{summary}</p>}
      {markets.length > 0 && (
        <div style={{ display: "grid" }}>
          {markets.map((m) => (
            <Link key={m.id} href={m.url} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--od-line2)" }}>
              <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, color: "var(--od-ink)" }}>{m.q}</span>
                <span className="mono" style={{ fontWeight: 500, fontSize: 10.5, color: "var(--od-ink3)" }}>
                  {fmtV(m.vol)} 24h{m.close ? ` · closes ${m.close}` : ""}
                </span>
              </span>
              <span style={{ display: "grid", justifyItems: "end" }}>
                <b className="mono" style={{ fontWeight: 700, fontSize: 17, color: "var(--od-ink)" }}>
                  {pct(m.p)}%
                </b>
                <span className="mono" style={{ fontWeight: 700, fontSize: 11, color: chgCol(m.chg) }}>
                  {chg(m.chg)}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12.5 }}>
        {link ? (
          external ? (
            <a href={link} target="_blank" rel="noopener nofollow" style={{ fontWeight: 700, color: "var(--od-brand)" }}>
              {linkLabel}
            </a>
          ) : (
            <Link href={link} style={{ fontWeight: 700, color: "var(--od-brand)" }}>
              {linkLabel}
            </Link>
          )
        ) : (
          <span />
        )}
        {hint && <span style={{ color: "var(--od-ink3)" }}>{hint}</span>}
      </div>
    </div>
  );
}
