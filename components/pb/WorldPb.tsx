"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useNow } from "@/components/pb/useNow";
import type { Globe, GlobeState } from "@/components/pb/worldGlobe";
import { fa, faAgo, probWord } from "@/lib/pb";
import { wVol, wVolS, type WC, type WM, type WorldView } from "@/lib/world";

/**
 * PB World Map — «نقشهٔ جهان» (design: PB World Map.html; handoff
 * WORLD_MAP_HANDOFF.md). The hero, totals, movers and the FULL ranked list are
 * server-rendered; the canvas globe (components/pb/worldGlobe.ts, d3 +
 * topojson) is imported after hydration so it never blocks that content.
 * Data: GET /world via the page (ISR) and /api/world every 60s.
 */

type Metric = GlobeState["metric"];

/** Kept in sync with REGIONS in worldGlobe.ts (labels only; the globe owns centres and members). */
const REGION_CHIPS: [string, string][] = [
  ["all", "همهٔ جهان"],
  ["me", "خاورمیانه"],
  ["eu", "اروپا و روسیه"],
  ["am", "قارهٔ آمریکا"],
  ["as", "آسیا"],
  ["af", "آفریقا"],
];

const RANK_SHOWN = 12;
const REFRESH_MS = 60_000;

const isPhone = () => window.innerWidth < 980;
const pctColor = (p: number | null) => (p !== null && p >= 50 ? "var(--gold)" : "var(--text)");
const pctText = (p: number | null) => (p === null ? "—" : `${fa(p)}٪`);

function MarketRow({ m, self, byKey }: { m: WM; self: string; byKey: Map<string, WC> }) {
  const col = pctColor(m.p);
  const others = m.ids.filter((x) => x !== self && byKey.has(x)).map((x) => byKey.get(x)!.fa);
  const href = `/market/${m.slug}`;
  return (
    <div className="mk">
      <div className="mk-r">
        <a className="mk-q" href={href} dir="auto">{m.q}</a>
        <div className="mk-p">
          <b style={{ color: col }}>{pctText(m.p)}</b>
          <span>{m.p === null ? "" : probWord(m.p)}</span>
        </div>
      </div>
      <div className="bar"><i style={{ width: `${Math.max(m.p ?? 0, 2)}%`, background: col }} /></div>
      <div className="mk-m">
        <span>
          {m.d ? (
            <>
              <b style={{ color: m.d > 0 ? "var(--up)" : "var(--down)", fontWeight: 800 }}>{m.d > 0 ? "▲" : "▼"} {fa(Math.abs(m.d))}</b> امروز ·{" "}
            </>
          ) : null}
          حجم ۲۴س {wVol(m.v)}{m.close ? ` · تا ${m.close}` : ""}
          {others.length > 0 && (
            <>
              <br />
              <span className="with">همچنین: {others.join("، ")}</span>
            </>
          )}
        </span>
        <a className="yes" href={href}>بله</a>
        <a className="no" href={href}>خیر</a>
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
}: {
  c: WC | null;
  pinned: boolean;
  metric: Metric;
  rank: number;
  view: WorldView;
  byKey: Map<string, WC>;
  onUnpin: () => void;
}) {
  if (!c) {
    return (
      <div className="empty">
        <b style={{ color: "var(--text)", fontSize: 16 }}>روی یک کشور بروید</b>
        کشورهای روشن‌تر بازارهای پرپول‌تری دارند. یکی را انتخاب کنید تا بازارهایش اینجا بیاید.
      </div>
    );
  }
  return (
    <>
      <div className="p-top">
        <div className="p-name">
          <small>{c.en} · رتبهٔ {fa(rank)} در {metric === "vol" ? "حجم" : "ریسک"}</small>
          <h2>{c.fa}</h2>
        </div>
        {pinned && <button className="pin" onClick={onUnpin}>سنجاق‌شده ✕</button>}
      </div>
      <div className="stats">
        <div className="stat"><span>حجم ۲۴ ساعت</span><b style={metric === "vol" ? { color: "var(--gold)" } : undefined}>{wVolS(c.v)}</b></div>
        <div className="stat"><span>بازار فعال</span><b>{fa(c.n)}</b></div>
        <div className="stat"><span>ریسک تنش</span><b style={metric === "risk" ? { color: "var(--down)" } : undefined}>{fa(c.r)}٪</b></div>
      </div>
      {/* Capped: the US alone sits in ~20 topics, which buried the markets under a wall of chips. */}
      <div className="chips">
        {c.topics.slice(0, 6).map((t) => <span key={t}>{t}</span>)}
        {c.topics.length > 6 && <span>+{fa(c.topics.length - 6)}</span>}
      </div>
      <div>
        <div className="sec">داغ‌ترین بازارها <span>{fa(Math.min(6, c.mk.length))} از {fa(c.n)}</span></div>
        {c.mk.map((i) => <MarketRow key={view.markets[i].slug} m={view.markets[i]} self={c.key} byKey={byKey} />)}
      </div>
      {c.cta && <a className="cta" href={c.cta}>همهٔ بازارهای {c.fa} ←</a>}
    </>
  );
}

export function WorldPb({ initial, renderedAt }: { initial: WorldView; renderedAt: number }) {
  const [view, setView] = useState(initial);
  const [metric, setMetric] = useState<Metric>("vol");
  const [region, setRegionK] = useState("all");
  const [selKey, setSelKey] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(() => (initial.countries.find((c) => c.geo === "364") ?? initial.countries[0])?.key ?? null);
  const [showAll, setShowAll] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [geo, setGeo] = useState<"loading" | "ok" | "fail">("loading");
  const now = useNow(30_000);

  const byKey = useMemo(() => new Map(view.countries.map((c) => [c.key, c])), [view]);
  const sel = selKey ? byKey.get(selKey) ?? null : null;
  const preview = previewKey ? byKey.get(previewKey) ?? null : null;
  const metricVal = useCallback((c: WC) => (metric === "vol" ? c.v : c.r), [metric]);
  const ranked = useMemo(() => [...view.countries].sort((a, b) => metricVal(b) - metricVal(a)), [view, metricVal]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<Globe | null>(null);
  const stateRef = useRef<GlobeState>({ metric, region, sel });
  const viewRef = useRef(view);
  useEffect(() => {
    stateRef.current = { metric, region, sel };
  }, [metric, region, sel]);

  const select = useCallback((c: WC | null, fly = true) => {
    setSelKey(c?.key ?? null);
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
  const sheetOpenedAt = useRef(0);
  const closeFromScrim = () => {
    if (performance.now() - sheetOpenedAt.current < 450) return;
    select(null, false);
  };
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
              if (c && !stateRef.current.sel) setPreviewKey(c.key);
            },
            onTap: (c, fly) => selectRef.current(c, fly),
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
        // Arrived on /world#IR (a ranked row's href): pin that country.
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
        const r = await fetch("/api/world");
        if (!r.ok) return;
        const next = (await r.json()) as WorldView;
        if (Array.isArray(next.countries) && next.countries.length) setView(next);
      } catch {
        /* keep the last good view */
      }
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  const setRegion = (k: string) => {
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
  const updated = view.asOf ? faAgo(view.asOf, now ?? renderedAt) : "—";

  return (
    <div dir="rtl" className={`pb wm${sheetOpen ? " sheet-open" : ""}`}>
      <div className="wm-main">
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="crumb"><Link href="/">خانه</Link> › سیاست و جهان</div>
          <h1>نقشهٔ جهان <span className="live"><b />زنده</span></h1>
          <p className="lede">هر کشور به اندازهٔ پولی روشن می‌شود که همین حالا روی آینده‌اش شرط بسته شده. روی کشوری بروید یا آن را بزنید تا داغ‌ترین پرسش‌هایش، احتمال زنده و حجم ۲۴ ساعت هر کدام را ببینید.</p>
          <div className="totals">
            <span><b>{wVol(view.totals.vol24h)}</b>حجم ۲۴ ساعت</span>
            <span><b>{fa(view.totals.countries)}</b>کشور با بازار فعال</span>
            <span><b>{fa(view.totals.markets)}</b>بازار فعال</span>
            <span><b>{updated}</b>آخرین به‌روزرسانی</span>
          </div>
        </section>

        {movers.length > 0 && (
          <section className="mv-row">
            <span className="lbl">بیشترین تغییر امروز</span>
            <div className="movers">
              {movers.map((m) => (
                <button key={m.slug} className="mv" data-c={m.ids[0]} onClick={(e) => pickCountry(e, m.ids[0])}>
                  <strong style={{ color: pctColor(m.p) }}>{pctText(m.p)}</strong>
                  <span dir="auto">{m.q}</span>
                  <em style={{ color: m.d! > 0 ? "var(--up)" : "var(--down)" }}>{m.d! > 0 ? "▲" : "▼"} {fa(Math.abs(m.d!))}</em>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="stage">
          <div className="gwrap" ref={wrapRef}>
            <canvas ref={canvasRef} aria-label="کرهٔ زمین؛ کشورها بر اساس حجم معامله روشن شده‌اند" />
            {geo !== "ok" && (
              <div className="loading">{geo === "fail" ? "نقشه بارگذاری نشد. فهرست کشورها در پایین صفحه در دسترس است." : "در حال بارگذاری نقشه…"}</div>
            )}
            <div className="ctrl">
              <div className={`seg${metric === "risk" ? " risk" : ""}`}>
                {(["vol", "risk"] as const).map((k) => (
                  <button key={k} data-m={k} className={metric === k ? "on" : undefined} onClick={() => setMetric(k)}>
                    {k === "vol" ? "حجم معامله" : "بیشترین ریسک"}
                  </button>
                ))}
              </div>
              <div className="regions">
                {REGION_CHIPS.map(([k, l]) => (
                  <button key={k} data-r={k} className={region === k ? "on" : undefined} onClick={() => setRegion(k)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="zoom">
              <button title="بزرگ‌نمایی" onClick={() => globeRef.current?.zoomBy(1.5)}>+</button>
              <button title="کوچک‌نمایی" onClick={() => globeRef.current?.zoomBy(1 / 1.5)}>−</button>
              <button
                title="بازگشت"
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
                {metric === "vol" ? <><span>هر کشور یک رنگ</span><span>روشن‌تر = پرپول‌تر</span></> : <><span>آرام</span><span>پرتنش</span></>}
              </div>
              <div className="hint">بکشید تا بچرخد · اسکرول برای زوم</div>
            </div>
            <div className="tip" ref={tipRef} />
          </div>
          <aside className="panel">
            <Panel c={panelC} pinned={!!sel && sel === panelC} metric={metric} rank={rankOf(panelC)} view={view} byKey={byKey} onUnpin={() => select(null)} />
          </aside>
        </section>

        <section style={{ display: "flex", flexDirection: "column" }}>
          <div className="rank-h">
            <h2>داغ‌ترین کشورها همین حالا</h2>
            <span>{metric === "vol" ? "بر اساس حجم معاملهٔ ۲۴ ساعت گذشته" : "بر اساس میانگین احتمال رخدادهای تنش‌زا در بازارهای هر کشور"}</span>
          </div>
          <ol className={`rank${showAll ? " all" : ""}`}>
            {ranked.map((c, i) => {
              const m = c.mk.length ? view.markets[c.mk[0]] : null;
              return (
                <li key={c.key} id={c.iso2}>
                  <a className={`rk${sel === c ? " on" : ""}`} href={c.href} data-c={c.key} onClick={(e) => pickCountry(e, c.key)}>
                    <span className="rk-n">{fa(i + 1)}</span>
                    <span className="rk-c">
                      {metric === "vol" && <i style={{ background: `rgb(var(--wm-p${c.ci}))` }} />}
                      <b>{c.fa}</b>
                      <small><span className="rk-en">{c.en} · </span>{fa(c.n)} بازار</small>
                    </span>
                    <span className="rk-v" style={{ color: mcol }}>
                      {metric === "vol" ? wVolS(c.v) : `${fa(c.r)}٪`}
                      <small>{metric === "vol" ? "حجم ۲۴س" : "ریسک"}</small>
                    </span>
                    <span className="bar"><i style={{ width: `${(metricVal(c) / topVal) * 100}%`, background: mcol, opacity: 0.7 }} /></span>
                    {m && <span className="rk-q"><bdi dir="auto">{m.q}</bdi> <b>{pctText(m.p)}</b></span>}
                  </a>
                </li>
              );
            })}
          </ol>
          {!showAll && ranked.length > RANK_SHOWN && (
            <button className="more" onClick={() => setShowAll(true)}>نمایش همهٔ کشورها</button>
          )}
        </section>
        <div style={{ fontSize: 11.5, color: "var(--faint)" }}>قیمت‌ها از Polymarket · درصدها احتمال از نگاه بازار است، نه پیش‌بینی پلی‌باز</div>
      </div>

      <div className="scrim" onClick={closeFromScrim} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="grab" />
        <button className="sheet-x" aria-label="بستن" onClick={() => select(null, false)}>✕</button>
        <div className="panel">
          {sel && <Panel c={sel} pinned metric={metric} rank={rankOf(sel)} view={view} byKey={byKey} onUnpin={() => select(null)} />}
        </div>
      </div>
    </div>
  );
}
