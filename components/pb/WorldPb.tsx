"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useNow, useTimeZone } from "@/components/pb/useNow";
import type { Globe, GlobeState } from "@/components/pb/worldGlobe";
import type { Dict } from "@/lib/dict/en";
import { agoOf, dayMonthOf, num, pctOf, probWordOf, type PbLang } from "@/lib/pb";
import { REGIONS, REG_SET, wVol, wVolS, type RegionKey, type WC, type WM, type WN, type WorldView } from "@/lib/world";

/**
 * PB World Map — «نقشهٔ جهان» (design: PB World Map.html; handoff
 * WORLD_MAP_HANDOFF.md). The hero, totals, movers and the FULL ranked list are
 * server-rendered; the canvas globe (components/pb/worldGlobe.ts, d3 +
 * topojson) is imported after hydration so it never blocks that content.
 * Data: GET /world via the page (ISR) and /api/world every 60s.
 */

type Metric = GlobeState["metric"];
export type WorldT = Dict["world"];

/** The page's language bundle: PolyBaaz (fa, RTL) or Oddzy (en, LTR). */
type L = { lang: PbLang; t: WorldT; tz: string };

/** "{n} markets" → "12 markets". */
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

const RANK_SHOWN = 12;
const REFRESH_MS = 60_000;
/** Stories younger than this get the blinking red dot. */
const FRESH_MS = 15 * 60_000;

const isPhone = () => window.innerWidth < 980;
const pctColor = (p: number | null) => (p !== null && p >= 50 ? "var(--gold)" : "var(--text)");

function MarketRow({ m, self, byKey, l }: { m: WM; self: string | string[]; byKey: Map<string, WC>; l: L }) {
  const { lang, t } = l;
  const col = pctColor(m.p);
  const others = m.ids.filter((x) => (Array.isArray(self) ? !self.includes(x) : x !== self) && byKey.has(x)).map((x) => byKey.get(x)!.name);
  const href = `/market/${m.slug}`;
  const close = lang === "fa" ? m.close : m.closeAt ? dayMonthOf(lang, m.closeAt, l.tz) : null;
  return (
    <div className="mk">
      <div className="mk-r">
        <a className="mk-q" href={href} dir="auto">{m.q}</a>
        <div className="mk-p">
          <b style={{ color: col }}>{pctOf(lang, m.p)}</b>
          <span>{m.p === null ? "" : probWordOf(lang, m.p)}</span>
        </div>
      </div>
      <div className="bar"><i style={{ width: `${Math.max(m.p ?? 0, 2)}%`, background: col }} /></div>
      <div className="mk-m">
        <span>
          {m.d ? (
            <>
              <b style={{ color: m.d > 0 ? "var(--up)" : "var(--down)", fontWeight: 800 }}>{m.d > 0 ? "▲" : "▼"} {num(lang, Math.abs(m.d))}</b> {t.today} ·{" "}
            </>
          ) : null}
          {fill(t.volLine, { v: wVol(m.v, lang) })}{close ? ` · ${fill(t.until, { d: close })}` : ""}
          {others.length > 0 && (
            <>
              <br />
              <span className="with">{t.also} {others.join(t.listSep)}</span>
            </>
          )}
        </span>
        <a className="yes" href={href}>{t.yes}</a>
        <a className="no" href={href}>{t.no}</a>
      </div>
    </div>
  );
}

function Panel({
  c,
  pinned,
  metric,
  rank,
  view,
  byKey,
  onUnpin,
  l,
}: {
  c: WC | null;
  pinned: boolean;
  metric: Metric;
  rank: number;
  view: WorldView;
  byKey: Map<string, WC>;
  onUnpin: () => void;
  l: L;
}) {
  const { lang, t } = l;
  if (!c) {
    return (
      <div className="empty">
        <b style={{ color: "var(--text)", fontSize: 16 }}>{t.emptyTitle}</b>
        {t.emptyBody}
      </div>
    );
  }
  const rankLine = fill(t.rankLine, { n: num(lang, rank), m: metric === "vol" ? t.metricVol : t.metricRisk });
  return (
    <>
      <div className="p-top">
        <div className="p-name">
          {/* PolyBaaz leads with the English name; on Oddzy the heading already is it. */}
          <small>{lang === "fa" ? `${c.en} · ${rankLine}` : rankLine}</small>
          <h2>{c.name}</h2>
        </div>
        {pinned && <button className="pin" onClick={onUnpin}>{t.pinned}</button>}
      </div>
      <div className="stats">
        <div className="stat"><span>{t.statVol}</span><b style={metric === "vol" ? { color: "var(--gold)" } : undefined}>{wVolS(c.v, lang)}</b></div>
        <div className="stat"><span>{t.statMarkets}</span><b>{num(lang, c.n)}</b></div>
        <div className="stat"><span>{t.statRisk}</span><b style={metric === "risk" ? { color: "var(--down)" } : undefined}>{pctOf(lang, c.r)}</b></div>
      </div>
      {/* Capped: the US alone sits in ~20 topics, which buried the markets under a wall of chips. */}
      <div className="chips">
        {c.topics.slice(0, 6).map((x) => <span key={x}>{x}</span>)}
        {c.topics.length > 6 && <span>+{num(lang, c.topics.length - 6)}</span>}
      </div>
      <div>
        <div className="sec">{t.hottest} <span>{fill(t.hottestCount, { a: num(lang, Math.min(6, c.mk.length)), b: num(lang, c.n) })}</span></div>
        {c.mk.map((i) => <MarketRow key={view.markets[i].slug} m={view.markets[i]} self={c.key} byKey={byKey} l={l} />)}
      </div>
      {c.cta && <a className="cta" href={c.cta}>{fill(t.countryCta, { c: c.name })}</a>}
    </>
  );
}

/** The related market that moved most today (the card's badge); null when none moved. */
function biggestMove(n: WN, view: WorldView): number | null {
  let best = 0;
  for (const i of n.mk) {
    const d = view.markets[i]?.d ?? 0;
    if (Math.abs(d) > Math.abs(best)) best = d;
  }
  return best || null;
}

function NewsDetail({
  n,
  now,
  view,
  byKey,
  onClose,
  onCountry,
  l,
}: {
  n: WN;
  now: number;
  view: WorldView;
  byKey: Map<string, WC>;
  onClose: () => void;
  onCountry: (e: MouseEvent, key: string) => void;
  l: L;
}) {
  const { lang, t } = l;
  const cs = n.ids.filter((k) => byKey.has(k));
  return (
    <>
      <div className="p-top">
        <div className="p-name">
          <small>{n.src} · {agoOf(lang, n.at, now)}</small>
          <h2 style={{ fontSize: 19, lineHeight: lang === "fa" ? 1.65 : 1.35, fontWeight: 800 }}>{n.q}</h2>
        </div>
        <button className="pin" aria-label={t.close} onClick={onClose}>✕</button>
      </div>
      {n.s && <p style={{ margin: 0, fontSize: 13.5, lineHeight: lang === "fa" ? 1.9 : 1.6, color: "var(--text2)" }}>{n.s}</p>}
      {cs.length > 0 && (
        <div className="chips">
          {cs.map((k) => <button key={k} data-c={k} onClick={(e) => onCountry(e, k)}>{byKey.get(k)!.name}</button>)}
        </div>
      )}
      {n.mk.length > 0 && (
        <div>
          <div className="sec">{t.relatedTitle} <span>{fill(n.mk.length === 1 ? t.nMarket1 : t.nMarkets, { n: num(lang, n.mk.length) })}</span></div>
          {n.mk.map((i) => <MarketRow key={view.markets[i].slug} m={view.markets[i]} self={n.ids} byKey={byKey} l={l} />)}
        </div>
      )}
      <a href={n.url} target="_blank" rel="noopener" style={{ fontSize: 12.5, fontWeight: 700 }}>{fill(t.fullStory, { s: n.src })}</a>
    </>
  );
}

function NewsFeed({
  view,
  byKey,
  sel,
  region,
  openId,
  now,
  onOpen,
  onClear,
  l,
}: {
  view: WorldView;
  byKey: Map<string, WC>;
  sel: WC | null;
  region: RegionKey;
  openId: string | null;
  now: number;
  onOpen: (n: WN) => void;
  onClear: () => void;
  l: L;
}) {
  const { lang, t } = l;
  // A pinned country filters to its stories (with «همهٔ اخبار» to clear); else a region chip
  // filters to the region's. Either falls back to everything when nothing matches.
  let list = view.news, title = t.newsTitle, clear = false;
  const reg = REG_SET[region] ?? null;
  if (sel) {
    const f = view.news.filter((n) => n.ids.includes(sel.key));
    if (f.length) { list = f; title = fill(t.newsOf, { x: sel.name }); clear = true; }
  } else if (reg) {
    const f = view.news.filter((n) => n.ids.some((k) => reg.has(k)));
    if (f.length) { list = f; title = fill(t.newsOf, { x: t.regions[region] }); }
  }
  return (
    <>
      <div className="news-h">
        <h2>{title}</h2>
        {clear && <button onClick={onClear}>{t.allNews}</button>}
      </div>
      <div className="news-list">
        {list.map((n) => {
          const names = n.ids.filter((k) => byKey.has(k)).map((k) => byKey.get(k)!.name);
          const mv = biggestMove(n, view);
          return (
            <button key={n.id} className={`nw${openId === n.id ? " on" : ""}`} data-n={n.id} onClick={() => onOpen(n)}>
              <span className="nw-m">
                {now - Date.parse(n.at) < FRESH_MS && <b className="fresh" />}
                {n.src} · {agoOf(lang, n.at, now)}
              </span>
              <span className="nw-t">{n.q}</span>
              {(names.length > 0 || n.mk.length > 0) && (
                <span className="nw-f">
                  {names.length > 0 && <span>{names.join(t.listSep)}</span>}
                  {names.length > 0 && n.mk.length > 0 && <span>·</span>}
                  {n.mk.length > 0 && <span>{fill(n.mk.length === 1 ? t.relatedCount1 : t.relatedCount, { n: num(lang, n.mk.length) })}</span>}
                  {mv && <span style={{ color: mv > 0 ? "var(--up)" : "var(--down)", fontWeight: 800 }}>{mv > 0 ? "▲" : "▼"} {num(lang, Math.abs(mv))}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

export function WorldPb({ initial, renderedAt, lang = "fa", t }: { initial: WorldView; renderedAt: number; lang?: PbLang; t: WorldT }) {
  const tz = useTimeZone(lang);
  const l: L = { lang, t, tz };
  const [view, setView] = useState(initial);
  const [metric, setMetric] = useState<Metric>("vol");
  const [region, setRegionK] = useState<RegionKey>("all");
  const [selKey, setSelKey] = useState<string | null>(null);
  const [newsId, setNewsId] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(() => (initial.countries.find((c) => c.geo === "364") ?? initial.countries[0])?.key ?? null);
  const [showAll, setShowAll] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [geo, setGeo] = useState<"loading" | "ok" | "fail">("loading");
  const now = useNow(30_000);

  const byKey = useMemo(() => new Map(view.countries.map((c) => [c.key, c])), [view]);
  const sel = selKey ? byKey.get(selKey) ?? null : null;
  const preview = previewKey ? byKey.get(previewKey) ?? null : null;
  // A refresh can drop the open story; the panel then falls back to the country.
  const story = newsId ? view.news.find((n) => n.id === newsId) ?? null : null;
  const metricVal = useCallback((c: WC) => (metric === "vol" ? c.v : c.r), [metric]);
  const ranked = useMemo(() => [...view.countries].sort((a, b) => metricVal(b) - metricVal(a)), [view, metricVal]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<Globe | null>(null);
  const storyIds = story?.ids ?? null;
  const stateRef = useRef<GlobeState>({ metric, region, sel, news: storyIds });
  const viewRef = useRef(view);
  useEffect(() => {
    stateRef.current = { metric, region, sel, news: storyIds };
  }, [metric, region, sel, storyIds]);

  const sheetOpenedAt = useRef(0);
  const select = useCallback((c: WC | null, fly = true) => {
    setSelKey(c?.key ?? null);
    setNewsId(null);
    if (c) setPreviewKey(c.key);
    if (c && fly) globeRef.current?.flyToCountry(c);
    if (c && isPhone()) {
      sheetOpenedAt.current = performance.now();
      setSheetOpen(true);
    }
    if (!c) setSheetOpen(false);
  }, []);
  // A tap on the globe opens the sheet on pointerup; the browser then fires its
  // compatibility click at the same spot, which lands on the scrim that just
  // appeared and closed the sheet again — so tapping a country "did nothing".
  const closeFromScrim = () => {
    if (performance.now() - sheetOpenedAt.current < 450) return;
    select(null, false);
  };
  // A story takes over the panel (or the sheet on phone); the globe fits its countries.
  const openNews = useCallback((n: WN) => {
    setNewsId(n.id);
    setSelKey(null);
    globeRef.current?.flyToNews(n.ids);
    if (isPhone()) {
      // Same ghost-click guard as a globe tap: the scrim appears under the finger.
      sheetOpenedAt.current = performance.now();
      setSheetOpen(true);
      window.scrollTo({ top: wrapRef.current!.getBoundingClientRect().top + scrollY - 70, behavior: "smooth" });
    }
  }, []);
  // The globe calls back from its own event handlers; keep it pointed at the latest closures.
  const selectRef = useRef(select);
  const byKeyRef = useRef(byKey);
  useEffect(() => {
    selectRef.current = select;
    byKeyRef.current = byKey;
    viewRef.current = view;
  }, [select, byKey, view]);

  // Boot the globe after hydration; d3 + topojson arrive in their own chunk.
  useEffect(() => {
    let dead = false;
    let g: Globe | null = null;
    import("@/components/pb/worldGlobe")
      .then(({ createGlobe }) =>
        createGlobe(
          {
            wrap: wrapRef.current!,
            canvas: canvasRef.current!,
            tip: tipRef.current!,
            getState: () => stateRef.current,
            isPhone,
            onHover: (c) => {
              if (c && !stateRef.current.sel && !stateRef.current.news) setPreviewKey(c.key);
            },
            onTap: (c, fly) => selectRef.current(c, fly),
            lang,
            labels: { tipVol: t.tipVol, tipRisk: t.tipRisk, tipMarkets: t.tipMarkets, tipMarket1: t.tipMarket1, tipPin: t.tipPin },
          },
          viewRef.current.countries,
          viewRef.current.markets,
        ),
      )
      .then((made) => {
        if (dead) return made.destroy();
        g = made;
        globeRef.current = made;
        setGeo("ok");
        // Arrived on /world#IR (Oddzy: /#IR), a ranked row's href: pin that country.
        const iso = decodeURIComponent(location.hash.slice(1)).toUpperCase();
        const hit = iso && viewRef.current.countries.find((c) => c.iso2 === iso);
        if (hit) selectRef.current(hit);
      })
      .catch(() => {
        if (!dead) setGeo("fail");
      });
    return () => {
      dead = true;
      g?.destroy();
      globeRef.current = null;
    };
    // Boots once; lang and copy are fixed for the page's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    globeRef.current?.setData(view.countries, view.markets);
  }, [view]);

  // Theme: the site toggle stamps data-theme on <html>; the canvas re-reads its palette.
  useEffect(() => {
    const mo = new MutationObserver(() => globeRef.current?.readColors());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (!isPhone()) setSheetOpen(false);
    };
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
  }, []);

  // Refresh every 60s (handoff §5).
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch(lang === "fa" ? "/api/world" : `/api/world?lang=${lang}`);
        if (!r.ok) return;
        const next = (await r.json()) as WorldView;
        if (Array.isArray(next.countries) && next.countries.length) setView(next);
      } catch {
        /* keep the last good view */
      }
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [lang]);

  const setRegion = (k: RegionKey) => {
    setRegionK(k);
    globeRef.current?.flyToRegion(k);
  };

  const scrollToGlobe = () => {
    const top = wrapRef.current!.getBoundingClientRect().top + scrollY;
    if (isPhone()) window.scrollTo({ top: top - 70, behavior: "smooth" });
    else window.scrollTo({ top: Math.max(0, top - 80), behavior: "smooth" });
  };

  const pickCountry = (e: MouseEvent, key: string | undefined) => {
    // Modified clicks keep the link's native behaviour (new tab / window).
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const c = key ? byKey.get(key) : undefined;
    if (!c) return;
    select(c);
    scrollToGlobe();
  };

  const panelC = sel || preview;
  const rankOf = (c: WC | null) => (c ? ranked.indexOf(c) + 1 : 0);
  const topVal = ranked.length ? metricVal(ranked[0]) || 1 : 1;
  const mcol = metric === "vol" ? "var(--gold)" : "var(--down)";
  const movers = view.movers.map((i) => view.markets[i]);
  const updated = view.asOf ? agoOf(lang, view.asOf, now ?? renderedAt) : "—";
  const storyEl = story && (
    <NewsDetail n={story} now={now ?? renderedAt} view={view} byKey={byKey} onClose={() => select(null, false)} onCountry={pickCountry} l={l} />
  );

  return (
    <div dir={lang === "fa" ? "rtl" : "ltr"} className={`pb wm${sheetOpen ? " sheet-open" : ""}`}>
      <div className="wm-main">
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Oddzy opens on this page, so it has no crumb to show — a kicker instead. */}
          {lang === "fa" ? (
            <div className="crumb"><Link href="/">{t.crumbHome}</Link> › {t.crumbHere}</div>
          ) : (
            <div className="crumb">{t.kicker}</div>
          )}
          <h1>{t.h1} <span className="live"><b />{t.live}</span></h1>
          <p className="lede">{t.lede}</p>
          <div className="totals">
            <span><b>{wVol(view.totals.vol24h, lang)}</b>{t.totVol}</span>
            <span><b>{num(lang, view.totals.countries)}</b>{t.totCountries}</span>
            <span><b>{num(lang, view.totals.markets)}</b>{t.totMarkets}</span>
            <span><b>{updated}</b>{t.totUpdated}</span>
          </div>
        </section>

        {movers.length > 0 && (
          <section className="mv-row">
            <span className="lbl">{t.movers}</span>
            <div className="movers">
              {movers.map((m) => (
                <button key={m.slug} className="mv" data-c={m.ids[0]} onClick={(e) => pickCountry(e, m.ids[0])}>
                  <strong style={{ color: pctColor(m.p) }}>{pctOf(lang, m.p)}</strong>
                  <span dir="auto">{m.q}</span>
                  <em style={{ color: m.d! > 0 ? "var(--up)" : "var(--down)" }}>{m.d! > 0 ? "▲" : "▼"} {num(lang, Math.abs(m.d!))}</em>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="stage">
          <aside className="news" aria-label={t.newsAria}>
            <NewsFeed
              view={view}
              byKey={byKey}
              sel={sel}
              region={region}
              openId={story?.id ?? null}
              now={now ?? renderedAt}
              onOpen={openNews}
              onClear={() => select(null, false)}
              l={l}
            />
          </aside>
          <div className="gwrap" ref={wrapRef}>
            <canvas ref={canvasRef} aria-label={t.canvasAria} />
            {geo !== "ok" && (
              <div className="loading">{geo === "fail" ? t.loadFail : t.loading}</div>
            )}
            <div className="ctrl">
              <div className={`seg${metric === "risk" ? " risk" : ""}`}>
                {(["vol", "risk"] as const).map((k) => (
                  <button key={k} data-m={k} className={metric === k ? "on" : undefined} onClick={() => setMetric(k)}>
                    {k === "vol" ? t.metricVolBtn : t.metricRiskBtn}
                  </button>
                ))}
              </div>
              <div className="regions">
                {REGIONS.map(({ k }) => (
                  <button key={k} data-r={k} className={region === k ? "on" : undefined} onClick={() => setRegion(k)}>{t.regions[k]}</button>
                ))}
              </div>
            </div>
            <div className="zoom">
              <button title={t.zoomIn} onClick={() => globeRef.current?.zoomBy(1.5)}>+</button>
              <button title={t.zoomOut} onClick={() => globeRef.current?.zoomBy(1 / 1.5)}>−</button>
              <button
                title={t.reset}
                style={{ fontSize: 14 }}
                onClick={() => {
                  setRegion("all");
                  select(null, false);
                  globeRef.current?.resetIdle();
                }}
              >
                ⟲
              </button>
            </div>
            <div className="legend">
              <div className={`ramp ${metric}`} />
              <div className="ramp-l">
                {metric === "vol" ? <><span>{t.legendVolA}</span><span>{t.legendVolB}</span></> : <><span>{t.legendRiskA}</span><span>{t.legendRiskB}</span></>}
              </div>
              <div className="hint">{t.hint}</div>
            </div>
            <div className="tip" ref={tipRef} />
          </div>
          <aside className="panel">
            {storyEl || <Panel c={panelC} pinned={!!sel && sel === panelC} metric={metric} rank={rankOf(panelC)} view={view} byKey={byKey} onUnpin={() => select(null)} l={l} />}
          </aside>
        </section>

        <section style={{ display: "flex", flexDirection: "column" }}>
          <div className="rank-h">
            <h2>{t.rankTitle}</h2>
            <span>{metric === "vol" ? t.rankByVol : t.rankByRisk}</span>
          </div>
          <ol className={`rank${showAll ? " all" : ""}`}>
            {ranked.map((c, i) => {
              const m = c.mk.length ? view.markets[c.mk[0]] : null;
              return (
                <li key={c.key} id={c.iso2}>
                  <a className={`rk${sel === c ? " on" : ""}`} href={c.href} data-c={c.key} onClick={(e) => pickCountry(e, c.key)}>
                    <span className="rk-n">{num(lang, i + 1)}</span>
                    <span className="rk-c">
                      {metric === "vol" && <i style={{ background: `rgb(var(--wm-p${c.ci}))` }} />}
                      <b>{c.name}</b>
                      {/* PolyBaaz shows the English name beside the Persian one; Oddzy would repeat it. */}
                      <small>{lang === "fa" && <span className="rk-en">{c.en} · </span>}{fill(c.n === 1 ? t.nMarket1 : t.nMarkets, { n: num(lang, c.n) })}</small>
                    </span>
                    <span className="rk-v" style={{ color: mcol }}>
                      {metric === "vol" ? wVolS(c.v, lang) : pctOf(lang, c.r)}
                      <small>{metric === "vol" ? t.vol24hShort : t.risk}</small>
                    </span>
                    <span className="bar"><i style={{ width: `${(metricVal(c) / topVal) * 100}%`, background: mcol, opacity: 0.7 }} /></span>
                    {m && <span className="rk-q"><bdi dir="auto">{m.q}</bdi> <b>{pctOf(lang, m.p)}</b></span>}
                  </a>
                </li>
              );
            })}
          </ol>
          {!showAll && ranked.length > RANK_SHOWN && (
            <button className="more" onClick={() => setShowAll(true)}>{t.showAll}</button>
          )}
        </section>
        <div style={{ fontSize: 11.5, color: "var(--faint)" }}>{t.footnote}</div>
      </div>

      <div className="scrim" onClick={closeFromScrim} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="grab" />
        <button className="sheet-x" aria-label={t.close} onClick={() => select(null, false)}>✕</button>
        <div className="panel">
          {sel ? <Panel c={sel} pinned metric={metric} rank={rankOf(sel)} view={view} byKey={byKey} onUnpin={() => select(null)} l={l} /> : storyEl}
        </div>
      </div>
    </div>
  );
}
