import Link from "next/link";
import { SiteChrome } from "@/components/site/Chrome";
import { getGuidesFor } from "@/lib/posts";
import { famView, famsIn, globeCountries, indexDesk, mini, newsItems, pickLead, row, sparkDays, type DeskIndex } from "@/lib/desk";
import { chg, chgBg, chgCol, fmtV, pct, topicUrl, word, type Desk, type DeskMarket, type SecKey } from "@/lib/od";
import { nowMs } from "@/lib/pb";
import { OdChart } from "./OdChart";
import { OdMiniGlobe } from "./OdMiniGlobe";
import { OdTable } from "./OdTable";
import { OdFamily, PolyBadge, SecHead, Spark, TradeBtn } from "./parts";
import type { GlobeCountry } from "./odGlobe";

/**
 * Section hubs (Politics / Economy / War & Geopolitics) and their subtopic
 * pages, from the redesign ("Oddzy Section", "Oddzy Subtopic"). Server
 * components over /desk; the globe, chart and question table are the only
 * client islands.
 */

const SEC_OF_SLUG: Record<string, SecKey> = { world: "war", politics: "pol", economy: "eco" };
export const isSectionSlug = (slug: string) => slug in SEC_OF_SLUG;

function globeList(ix: DeskIndex): GlobeCountry[] {
  return globeCountries(ix, 0).map((c) => ({ id: c.id, name: c.name, v: c.v, r: c.r, links: c.links }));
}

const rowsOf = (ix: DeskIndex, ms: DeskMarket[]) => ms.map((m) => row(ix, m));

export async function OdSectionScreen({ desk, slug }: { desk: Desk; slug: string }) {
  const now = nowMs();
  const ix = indexDesk(desk);
  const sec = SEC_OF_SLUG[slug];
  const S = desk.sections.find((s) => s.key === sec)!;
  const ms = desk.markets.filter((m) => m.sec === sec);
  const lead = pickLead(ix, now, { sec });

  // Section volume per country (a market split across its countries).
  const cv = new Map<string, number>();
  for (const m of ms) for (const id of m.countryIds) cv.set(id, (cv.get(id) ?? 0) + m.vol24h / m.countryIds.length);
  const byC = new Map(desk.countries.filter((c) => c.id).map((c) => [c.id as string, c]));
  const cIds = [...new Set([...(lead?.ids ?? []), ...[...cv.keys()].sort((a, b) => (cv.get(b) ?? 0) - (cv.get(a) ?? 0))])].filter((id) => byC.has(id)).slice(0, 6);

  const subs = S.subs
    .map((k) => desk.subs.find((s) => s.slug === k))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map((s) => {
      const top = ms.filter((m) => m.sub === s.slug).sort((a, b) => b.vol24h - a.vol24h)[0];
      return { ...s, top };
    })
    .filter((s) => s.top);
  const movers = [...ms]
    .filter((m) => m.chg !== null && m.vol24h >= 2_000)
    .sort((a, b) => Math.abs(b.chg ?? 0) - Math.abs(a.chg ?? 0))
    .slice(0, 8);
  const fams = famsIn(ix, { sec })
    .filter((k) => k !== lead?.fam?.key)
    .slice(0, 4)
    .map((k) => famView(ix, k))
    .filter((f) => f !== null);
  const news = newsItems(ix, now, (_n, linked) => linked.some((m) => m.sec === sec)).slice(0, 6);
  const guides = await getGuidesFor([slug], "en", 3).catch(() => []);

  return (
    <SiteChrome lang="en" od={sec}>
      <div className="od-main">
        <div style={{ padding: "28px 0 22px", borderBottom: "1px solid var(--od-line)", display: "grid", gap: 12 }}>
          <div className="mono" style={{ fontWeight: 600, fontSize: 11.5, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--od-ink3)" }}>
            <Link prefetch={false} href="/">World Map</Link> / <span style={{ color: "var(--od-ink2)" }}>{S.name}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "16px 40px" }}>
            <div style={{ display: "grid", gap: 10, maxWidth: 760 }}>
              <h1 className="serif" style={{ margin: 0, fontWeight: 500, fontSize: "clamp(42px,6vw,80px)", lineHeight: 0.95, letterSpacing: "-.025em" }}>
                {S.name}
              </h1>
              <p style={{ margin: 0, fontSize: 17, lineHeight: 1.5, color: "var(--od-ink2)", textWrap: "pretty" }}>{S.dek}</p>
              <PolyBadge label="Live Polymarket markets · trade directly on Polymarket" style={{ justifySelf: "start" }} />
            </div>
            <div style={{ display: "flex", gap: 28 }}>
              {(
                [
                  [String(S.markets), "Polymarket markets"],
                  [fmtV(S.vol24h), "24h volume"],
                  [String(cv.size), "countries"],
                ] as const
              ).map(([v, k]) => (
                <div key={k} style={{ display: "grid", gap: 2 }}>
                  <b className="mono" style={{ fontWeight: 700, fontSize: 24, letterSpacing: "-.03em" }}>
                    {v}
                  </b>
                  <span style={{ fontSize: 12.5, color: "var(--od-ink3)" }}>{k}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="od-lead">
          {lead && (
            <article style={{ display: "grid", gap: 18, minWidth: 0 }}>
              <div className="mono" style={{ fontWeight: 600, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--od-down)" }}>
                ● Lead story
              </div>
              <h2 className="serif" style={{ margin: 0, fontWeight: 500, fontSize: "clamp(28px,3vw,42px)", lineHeight: 1.08, letterSpacing: "-.012em", textWrap: "pretty", maxWidth: "22ch" }}>
                {lead.head}
              </h2>
              {lead.news.length > (lead.headIsStory ? 1 : 0) && (
                <div style={{ display: "grid", gap: 6 }}>
                  {lead.news.slice(lead.headIsStory ? 1 : 0).map((n) => (
                    <div key={n.k} style={{ display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.4, color: "var(--od-ink2)" }}>
                      <span className="mono" style={{ flex: "none", width: 84, fontWeight: 600, fontSize: 11, lineHeight: 1.6, color: "var(--od-ink3)" }}>
                        {n.src}
                      </span>
                      <span>{n.q}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className={lead.fam ? "od-fam2" : undefined}>
                {lead.fam && <OdFamily f={lead.fam} />}
                <KeyCard m={lead.key} now={now} chartH={120} />
              </div>
            </article>
          )}
          <aside style={{ background: "var(--od-panel)", border: "1px solid var(--od-line)", borderRadius: 18, overflow: "hidden", minWidth: 0 }}>
            <div style={{ position: "relative", height: 300, background: "radial-gradient(100% 80% at 50% 50%,var(--od-panel2),var(--od-panel))" }}>
              <OdMiniGlobe countries={globeList(ix)} focus={cIds.slice(0, 4)} />
              <span className="mono" style={{ position: "absolute", top: 12, insetInlineStart: 14, fontWeight: 600, fontSize: 10.5, letterSpacing: ".07em", color: "var(--od-ink3)" }}>
                COUNTRIES INVOLVED · BY CONFLICT RISK
              </span>
            </div>
            <div style={{ padding: "6px 16px 12px" }}>
              {cIds.map((id) => {
                const c = byC.get(id)!;
                const inner = (
                  <>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>
                      <span className="mono" style={{ fontWeight: 600, fontSize: 10.5, color: "var(--od-ink3)", marginInlineEnd: 8 }}>
                        {c.iso2}
                      </span>
                      {c.en}
                    </span>
                    <span className="mono" style={{ fontWeight: 700, fontSize: 13, textAlign: "end" }}>
                      {fmtV(cv.get(id) ?? 0)}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--od-line2)" }}>
                        <span style={{ display: "block", height: 4, borderRadius: 2, width: `${c.risk}%`, background: "var(--od-down)" }} />
                      </span>
                      <span className="mono" style={{ fontWeight: 600, fontSize: 11.5, color: "var(--od-ink2)", width: 28, textAlign: "end" }}>
                        {c.risk}
                      </span>
                    </span>
                  </>
                );
                const st: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0,1fr) 72px 92px", gap: 12, alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--od-line2)" };
                return c.topicSlug ? (
                  <Link prefetch={false} key={id} href={topicUrl(c.topicSlug)} style={st}>
                    {inner}
                  </Link>
                ) : (
                  <div key={id} style={st}>
                    {inner}
                  </div>
                );
              })}
              <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--od-ink3)" }}>Section 24h volume per country · conflict-risk score 0–100</p>
            </div>
          </aside>
        </section>

        <section style={{ paddingTop: 48 }}>
          <SecHead title="Subtopics" right={`${subs.length} DESKS`} style={{ marginBottom: 14 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,250px),1fr))", gap: 10 }}>
            {subs.map((t) => (
              <Link prefetch={false} key={t.slug} href={topicUrl(t.slug)} style={{ display: "grid", gap: 12, alignContent: "space-between", padding: 16, borderRadius: 14, background: "var(--od-panel)", border: "1px solid var(--od-line2)", minHeight: 150 }}>
                <span style={{ display: "grid", gap: 4 }}>
                  <span className="serif" style={{ fontWeight: 500, fontSize: 23, lineHeight: 1.1, color: "var(--od-ink)" }}>
                    {t.name}
                  </span>
                  <span className="mono" style={{ fontWeight: 500, fontSize: 11.5, color: "var(--od-ink3)" }}>
                    {t.markets} market{t.markets === 1 ? "" : "s"} · {fmtV(t.vol24h)} 24h
                  </span>
                </span>
                <span style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "end", paddingTop: 10, borderTop: "1px solid var(--od-line2)" }}>
                  <span className="clamp2" style={{ fontSize: 13, lineHeight: 1.35, color: "var(--od-ink2)" }}>
                    {t.top.title}
                  </span>
                  <span style={{ display: "grid", justifyItems: "end", gap: 3 }}>
                    <b className="mono" style={{ fontWeight: 700, fontSize: 19, color: "var(--od-ink)" }}>
                      {pct(t.top.yes)}%
                    </b>
                    <Spark h={t.top.spark} d={t.top.chg} w={52} ht={16} />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {movers.length > 0 && (
          <section style={{ paddingTop: 48 }}>
            <SecHead title={`Moving in ${S.short}`} right="24H CHANGE" style={{ marginBottom: 14 }} />
            <div className="noscroll" style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(260px,1fr)", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
              {movers.map((m) => (
                <Link prefetch={false} key={m.id} href={`/market/${m.slug}`} style={{ display: "grid", gap: 10, padding: 14, borderRadius: 12, background: "var(--od-panel)", border: "1px solid var(--od-line2)" }}>
                  <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="mono" style={{ fontWeight: 700, fontSize: 13, color: chgCol(m.chg), background: chgBg(m.chg), borderRadius: 6, padding: "5px 8px" }}>
                      {chg(m.chg)} pts
                    </span>
                    <Spark h={m.spark} d={m.chg} />
                  </span>
                  <span className="clamp2" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, color: "var(--od-ink)", minHeight: 36 }}>
                    {m.title}
                  </span>
                  <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <b className="mono" style={{ fontWeight: 700, fontSize: 22, color: "var(--od-ink)" }}>
                      {pct(m.yes)}%
                    </b>
                    <span className="mono" style={{ fontWeight: 500, fontSize: 11, color: "var(--od-ink3)" }}>
                      {fmtV(m.vol24h)} 24h
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="od-low">
          <OdTable rows={rowsOf(ix, ms)} title="All questions" chips={subs.map((s) => ({ key: s.slug, label: s.name }))} />
          <div style={{ minWidth: 0, display: "grid", gap: 40, alignContent: "start" }}>
            {fams.length > 0 && (
              <div>
                <SecHead title="Timelines" style={{ marginBottom: 12 }} />
                <div style={{ display: "grid", gap: 10 }}>
                  {fams.map((f) => (
                    <OdFamily key={f.key} f={f} />
                  ))}
                </div>
              </div>
            )}
            <NewsList title="Related news" items={news} />
          </div>
        </section>

        {guides.length > 0 && (
          <section style={{ paddingTop: 56 }}>
            <SecHead title="Guides" style={{ marginBottom: 14 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,300px),1fr))", gap: 10 }}>
              {guides.map((g) => (
                <Link prefetch={false} key={g.slug} href={`/learn/${g.slug}`} style={{ display: "grid", gap: 8, alignContent: "start", padding: 18, borderRadius: 14, border: "1px solid var(--od-line)" }}>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 10.5, letterSpacing: ".07em", color: "var(--od-ink3)" }}>
                    GUIDE
                  </span>
                  <span className="serif" style={{ fontWeight: 500, fontSize: 20, lineHeight: 1.2 }}>
                    {g.title}
                  </span>
                  <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--od-ink2)" }}>{g.description}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </SiteChrome>
  );
}

/** A market with its chart and the Trade button (lead "key" card, subtopic top question). */
function KeyCard({ m, now, chartH, big }: { m: ReturnType<typeof mini> & { tot: number; spark: number[] }; now: number; chartH: number; big?: boolean }) {
  return (
    <div style={{ background: "var(--od-panel)", border: "1px solid var(--od-line)", borderRadius: big ? 16 : 14, padding: big ? 18 : 16, display: "grid", gap: big ? 14 : 10, minWidth: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: big ? "flex-start" : "baseline", gap: big ? 12 : 10 }}>
        {big ? (
          <Link prefetch={false} href={m.url} className="serif" style={{ flex: "1 1 300px", fontWeight: 500, fontSize: "clamp(22px,2.2vw,30px)", lineHeight: 1.15, color: "var(--od-ink)" }}>
            {m.q}
          </Link>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, flex: 1, minWidth: 0 }}>{m.q}</span>
        )}
        <div style={{ display: "grid", justifyItems: "end" }}>
          <b className="mono" style={{ fontWeight: 700, fontSize: big ? 40 : 26, lineHeight: 1, letterSpacing: big ? "-.04em" : "-.03em" }}>
            {pct(m.p)}%
          </b>
          {big && (
            <span className="mono" style={{ fontWeight: 700, fontSize: 12.5, color: chgCol(m.chg) }}>
              {chg(m.chg)} today · {word(m.p)}
            </span>
          )}
        </div>
      </div>
      <OdChart points={m.spark} days={sparkDays(m.spark.length, now)} height={chartH} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span className="mono" style={{ flex: 1, fontWeight: 500, fontSize: big ? 12 : 11.5, color: "var(--od-ink3)" }}>
          {fmtV(m.vol)} 24h · {fmtV(m.tot)} total{m.close ? ` · closes ${m.close}` : ""}
        </span>
        <TradeBtn href={m.url} h={big ? 42 : 40} />
      </div>
    </div>
  );
}

function NewsList({ title, items, summaries }: { title: string; items: ReturnType<typeof newsItems>; summaries?: boolean }) {
  return (
    <div>
      <SecHead title={title} style={{ marginBottom: 4 }} />
      {items.length === 0 && <p style={{ fontSize: 14, color: "var(--od-ink3)", padding: "14px 0" }}>No linked stories in the last day.</p>}
      {items.map((n) => (
        <div key={n.k} style={{ display: "grid", gap: 6, padding: "14px 0", borderBottom: "1px solid var(--od-line2)" }}>
          <span className="mono" style={{ fontWeight: 600, fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--od-ink3)" }}>
            {n.src} · {n.ago}
          </span>
          <a href={n.url} target="_blank" rel="noopener nofollow" className="serif" style={{ fontWeight: 500, fontSize: summaries ? 19 : 18, lineHeight: 1.3 }}>
            {n.q}
          </a>
          {summaries && n.s && <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--od-ink2)" }}>{n.s}</span>}
          {n.m && (
            <Link prefetch={false}
              href={n.m.url}
              style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12.5, color: "var(--od-ink2)", ...(summaries ? { padding: "8px 10px", borderRadius: 9, background: "var(--od-chip)" } : {}) }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>{n.m.q}</span>
              <b className="mono" style={{ fontWeight: 700, fontSize: 14, color: "var(--od-ink)" }}>
                {pct(n.m.p)}%
              </b>
              <span className="mono" style={{ fontWeight: 700, fontSize: 11.5, color: chgCol(n.m.chg) }}>
                {chg(n.m.chg)}
              </span>
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

export async function OdSubtopicScreen({ desk, slug }: { desk: Desk; slug: string }) {
  const now = nowMs();
  const ix = indexDesk(desk);
  const T = desk.subs.find((s) => s.slug === slug)!;
  const S = desk.sections.find((s) => s.key === T.sec)!;
  const ms = desk.markets.filter((m) => m.sub === slug).sort((a, b) => b.vol24h - a.vol24h);
  const top = ms[0];
  // The country this desk is about, when it is about one (its /world topic).
  const c = desk.countries.find((x) => x.topicSlug === slug && x.id);
  const ids = [...new Set(ms.flatMap((m) => m.countryIds))];
  const counts = new Map<string, number>();
  for (const m of ms) for (const id of m.countryIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const primary = c?.id ? [c.id] : [...ids].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)).slice(0, 1);
  const focus = [...primary, ...ids.filter((x) => !primary.includes(x)).sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)).slice(0, 5)];
  const v24 = ms.reduce((a, m) => a + m.vol24h, 0);
  const moved = [...ms].filter((m) => m.chg !== null).sort((a, b) => Math.abs(b.chg ?? 0) - Math.abs(a.chg ?? 0))[0];
  const fams = famsIn(ix, { sub: slug })
    .slice(0, 4)
    .map((k) => famView(ix, k))
    .filter((f) => f !== null);
  const mset = new Set(ms.map((m) => m.id));
  const news = newsItems(ix, now, (n) => n.marketIds.some((id) => mset.has(id)) || (!!c?.id && n.countryIds.includes(c.id))).slice(0, 6);
  const stats: [string, string, string][] = [
    ["24h volume", fmtV(v24), "var(--od-ink)"],
    ["Live markets", String(ms.length), "var(--od-ink)"],
    ["Conflict risk", c ? `${c.risk}/100` : "—", c && c.risk >= 50 ? "var(--od-down)" : "var(--od-ink)"],
    ["Biggest move", moved ? chg(moved.chg) : "—", moved ? chgCol(moved.chg) : "var(--od-ink)"],
  ];
  const dek = T.dek ?? `Every market on ${T.name}, with the odds traders are paying right now.`;

  return (
    <SiteChrome lang="en" od={T.sec}>
      <div className="od-main">
        <div className="od-sub-top">
          <div style={{ display: "grid", gap: 14, alignContent: "start", minWidth: 0 }}>
            <div className="mono" style={{ fontWeight: 600, fontSize: 11.5, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--od-ink3)" }}>
              <Link prefetch={false} href="/">World Map</Link> / <Link prefetch={false} href={topicUrl(S.slug)}>{S.name}</Link> / <span style={{ color: "var(--od-ink2)" }}>{T.name}</span>
            </div>
            <h1 className="serif" style={{ margin: 0, fontWeight: 500, fontSize: "clamp(48px,7vw,96px)", lineHeight: 0.92, letterSpacing: "-.03em" }}>
              {T.name}
            </h1>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.5, color: "var(--od-ink2)", maxWidth: "52ch" }}>{dek}</p>
            <PolyBadge label="Live Polymarket markets · trade directly on Polymarket" style={{ justifySelf: "start" }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 1, background: "var(--od-line)", border: "1px solid var(--od-line)", borderRadius: 12, overflow: "hidden", marginTop: 6 }}>
              {stats.map(([k, v, col]) => (
                <div key={k} style={{ display: "grid", gap: 3, padding: "12px 14px", background: "var(--od-panel)", minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: "var(--od-ink3)" }}>{k}</span>
                  <b className="mono" style={{ fontWeight: 700, fontSize: "clamp(17px,2vw,24px)", letterSpacing: "-.03em", color: col }}>
                    {v}
                  </b>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 4 }}>
              <span style={{ fontSize: 12.5, color: "var(--od-ink3)", alignSelf: "center", marginInlineEnd: 4 }}>Also in {S.short}</span>
              {S.subs
                .filter((k) => k !== slug)
                .map((k) => desk.subs.find((s) => s.slug === k))
                .filter((s): s is NonNullable<typeof s> => !!s)
                .map((s) => (
                  <Link prefetch={false} key={s.slug} href={topicUrl(s.slug)} style={{ height: 30, padding: "0 12px", borderRadius: 999, border: "1px solid var(--od-line)", fontSize: 12.5, fontWeight: 600, color: "var(--od-ink2)", display: "flex", alignItems: "center" }}>
                    {s.name}
                  </Link>
                ))}
            </div>
          </div>
          <div className="od-sub-map" style={{ position: "relative", borderRadius: 18, border: "1px solid var(--od-line)", background: "radial-gradient(100% 80% at 50% 50%,var(--od-panel2),var(--od-bg))", overflow: "hidden" }}>
            <OdMiniGlobe countries={globeList(ix)} focus={focus} zoom={2.1} />
            <span className="mono" style={{ position: "absolute", top: 12, insetInlineStart: 14, fontWeight: 600, fontSize: 10.5, letterSpacing: ".07em", color: "var(--od-ink3)" }}>
              LINKED BY SHARED MARKETS
            </span>
          </div>
        </div>

        {top && (
          <section className="od-sub-mid">
            <div style={{ minWidth: 0, display: "grid", gap: 16 }}>
              <SecHead title="Top question" right="BY 24H VOLUME" />
              <KeyCard m={{ ...mini(top), tot: top.volTotal, spark: top.spark }} now={now} chartH={200} big />
              {fams.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,320px),1fr))", gap: 10 }}>
                  {fams.map((f) => (
                    <OdFamily key={f.key} f={f} />
                  ))}
                </div>
              )}
            </div>
            <NewsList title={`News on ${T.name}`} items={news} summaries />
          </section>
        )}

        <section style={{ paddingTop: 44 }}>
          <OdTable rows={rowsOf(ix, ms)} title={`Every ${T.name} question`} right={`${ms.length} MARKETS`} showSub={false} limit={60} />
        </section>
      </div>
    </SiteChrome>
  );
}
