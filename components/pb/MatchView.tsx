"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { MatchLive, MatchResultOption, WhaleGame } from "@/lib/api";
import { fa, faMoney, faPct, pc, SIDE_COLOR } from "@/lib/pb";
import { Crest } from "@/components/pb/Crest";
import { PredictCtas, PredictProvider, Presets, payout, usePredict, YesNo } from "@/components/pb/Predict";
import { useNow } from "@/components/pb/useNow";
import { betLabel, enSideNames, sideNames, tierOf, whaleName } from "@/components/pb/whale";

/**
 * The PolyBaaz match page (design: PB Match). Server page passes a snapshot;
 * this refreshes the headline odds and the whale strip from /api/match every
 * minute, which is what makes the «قیمت زنده» pill true.
 */

export type MatchRow = {
  slug: string;
  q: string;
  p: number | null;
  yes: string;
  no: string;
  h24: number;
  status: string;
  outcome: string | null;
};
export type MatchGroup = { key: string; label: string; rows: MatchRow[] };

export type MatchViewProps = {
  slug: string;
  title: string;
  crumbs: { name: string; href?: string }[];
  league: { name: string; logo: string | null } | null;
  kickoff: string | null;
  kickoffLabel: string | null;
  settled: boolean;
  live: MatchLive | null;
  resultType: "three_way" | "two_way" | "head_to_head" | null;
  options: MatchResultOption[];
  home: { name: string; logo: string | null } | null;
  away: { name: string; logo: string | null } | null;
  marketCount: number;
  vol24: number;
  resultVol24: number;
  groups: MatchGroup[];
  rulesNote: string;
  asOf: string;
};

type SideK = "home" | "draw" | "away";

const COLLAPSED = 8;

function sideKeyAt(i: number, n: number, label: string): SideK {
  if (label === "Draw") return "draw";
  return i === 0 ? "home" : i === n - 1 ? "away" : "draw";
}

function useCountdown(to: string | null) {
  const now = useNow(1000);
  if (!to || now === null) return null;
  const s = Math.floor((new Date(to).getTime() - now) / 1000);
  if (s <= 0) return { started: true, text: "" };
  const d = Math.floor(s / 86400);
  const hh = Math.floor((s % 86400) / 3600);
  const mm = String(Math.floor(s / 60) % 60).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return { started: false, text: d > 0 ? `${fa(d)} روز و ${fa(hh)}:${fa(mm)}` : fa(`${hh}:${mm}:${ss}`) };
}

export function MatchView(props: MatchViewProps) {
  return (
    <PredictProvider>
      <MatchInner {...props} />
    </PredictProvider>
  );
}

function MatchInner(p: MatchViewProps) {
  const open = usePredict();
  const [options, setOptions] = useState(p.options);
  const [settled, setSettled] = useState(p.settled);
  const [live, setLive] = useState<MatchLive | null>(p.live);
  // Over but not yet settled: no more predicting, and say why.
  const ended = !settled && live?.status === "ended";
  const closed = settled || ended;
  const [whales, setWhales] = useState<WhaleGame | null>(null);
  const [tab, setTab] = useState(p.groups[0]?.key ?? "");
  const [all, setAll] = useState(false);
  const [rules, setRules] = useState(false);
  const [pick, setPick] = useState(0);
  const [amt, setAmt] = useState(25);
  const [flash, setFlash] = useState<string | null>(null);
  const cd = useCountdown(p.kickoff);

  // Fresh odds + whales, now and every minute.
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/match/${encodeURIComponent(p.slug)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!alive || !d) return;
          if (d.result?.options?.length) setOptions(d.result.options);
          if (d.status && d.status !== "active") setSettled(true);
          if (d.live !== undefined) setLive(d.live);
          setWhales(d.whales ?? null);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [p.slug]);

  // ?m=<slug> (from an old /market/<slug> link): open its tab, expand, scroll, flash.
  const target = useRef<string | null>(null);
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("m");
    if (!m) return;
    const g = p.groups.find((x) => x.rows.some((r) => r.slug === m));
    if (!g) return;
    target.current = m;
    // Next frame, not synchronously in the effect: one extra render, after paint.
    const raf = requestAnimationFrame(() => {
      setTab(g.key);
      setAll(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [p.groups]);
  useEffect(() => {
    const m = target.current;
    if (!m) return;
    const el = document.getElementById(`mk-${m}`);
    if (el) {
      el.scrollIntoView({ block: "center" });
      target.current = null;
      const raf = requestAnimationFrame(() => setFlash(m));
      return () => cancelAnimationFrame(raf);
    }
  }, [tab, all]);

  const sub = [p.title, p.league?.name].filter(Boolean).join(" · ");
  const n = options.length;
  const probs = options.map((o) => pc(o.p) ?? 0);
  const mx = Math.max(...probs);
  const outs = options.map((o, i) => {
    const k = sideKeyAt(i, n, o.label);
    const name = o.label === "Draw" ? "مساوی" : o.label_fa ?? o.label;
    const label = p.resultType === "head_to_head" || o.label === "Draw" ? name : `برد ${name}`;
    return { o, k, name, label, pct: probs[i], fav: probs[i] === mx && mx > 0, col: SIDE_COLOR[k] };
  });
  const openSide = (i: number) => {
    const x = outs[i];
    if (!x || closed) return;
    // A fight's second side is the NO of the same market; the sheet opens that
    // market either way, with the side's own odds.
    open({ title: `${p.title}: ${x.label}؟`, sub, outcome: x.label, prob: x.pct, slug: x.o.slug });
  };

  const cur = p.groups.find((g) => g.key === tab) ?? p.groups[0];
  const rows = cur ? (all ? cur.rows : cur.rows.slice(0, COLLAPSED)) : [];

  const names = whales ? sideNames(whales) : null;
  const topWhales = (whales?.whales ?? []).slice(0, 2);

  const chip: CSSProperties = { fontSize: 12, color: "var(--text2)", border: "1px solid var(--line)", borderRadius: 999, padding: "3px 11px" };
  const sel = outs[Math.min(pick, outs.length - 1)];
  const { pay, mult } = payout(amt, sel?.pct || 50);

  return (
    <div dir="rtl" className="pb">
      <main
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "20px 16px 120px",
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: "1 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: 22 }}>
          <nav aria-label="Breadcrumb" style={{ fontSize: 12, color: "var(--muted)" }}>
            {p.crumbs.map((c, i) => (
              <span key={`${c.name}-${i}`}>
                {i > 0 && " › "}
                {c.href ? (
                  <Link href={c.href} style={{ color: "var(--muted)" }}>
                    {c.name}
                  </Link>
                ) : (
                  c.name
                )}
              </span>
            ))}
          </nav>

          <section style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 24, overflow: "hidden" }}>
            <div
              style={{
                padding: "22px 18px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
                background: "radial-gradient(120% 90% at 50% 0%, var(--goldbg), transparent 70%)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
                {p.league && <Crest name={p.league.name} src={p.league.logo} size={18} />}
                {p.league && <span>{p.league.name}</span>}
                {p.kickoffLabel && (
                  <>
                    <span style={{ color: "var(--faint)" }}>·</span>
                    <span>{p.kickoffLabel}</span>
                  </>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10 }}>
                <Team t={p.home} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  {live?.score && live.status !== "scheduled" ? (
                    <>
                      <span dir="ltr" style={{ fontSize: 34, fontWeight: 900, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
                        {/* LTR box, so print away–home to read home on the right as the crests do. */}
                        {fa(live.score.away)} – {fa(live.score.home)}
                      </span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 800,
                          color: live.status === "live" ? "var(--up)" : "var(--muted)",
                        }}
                      >
                        {live.status === "live" && <span className="pb-pulse" />}
                        {periodLabel(live)}
                      </span>
                    </>
                  ) : settled || ended ? (
                    <span style={{ fontSize: 16, fontWeight: 800, color: "var(--muted)" }}>پایان</span>
                  ) : cd && !cd.started ? (
                    <>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>تا شروع</span>
                      <span dir="ltr" style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums", letterSpacing: 0.5 }}>
                        {cd.text}
                      </span>
                    </>
                  ) : cd?.started ? (
                    <span style={{ fontSize: 15, fontWeight: 800, color: "var(--up)" }}>در جریان</span>
                  ) : (
                    <span style={{ fontSize: 15, color: "var(--faint)" }}>در برابر</span>
                  )}
                </div>
                <Team t={p.away} />
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={chip}>{fa(p.marketCount)} بازار</span>
                {!closed && p.vol24 > 0 && <span style={chip}>حجم ۲۴ ساعت {faMoney(p.vol24)}</span>}
                {ended && <span style={{ ...chip, color: "var(--gold)", borderColor: "var(--goldline)" }}>بازی تمام شد · در انتظار تسویهٔ رسمی</span>}
                {!closed && (
                  <span style={{ ...chip, display: "inline-flex", alignItems: "center", gap: 6, color: "var(--up)" }}>
                    <span className="pb-pulse" /> قیمت زنده
                  </span>
                )}
              </div>
            </div>

            {outs.length > 0 && (
              <div style={{ padding: "4px 18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text2)" }}>
                  {settled ? "نتیجهٔ نهایی" : "نتیجه، به روایت بازار"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${outs.length}, minmax(0,1fr))`, gap: 8 }}>
                  {outs.map((x, i) => {
                    const won = settled && x.o.won === true;
                    const hi = settled ? won : x.fav;
                    return (
                      <button
                        key={`${x.o.slug}-${x.o.label}`}
                        type="button"
                        onClick={() => openSide(i)}
                        disabled={closed}
                        className="pb-tile"
                        style={
                          {
                            "--tint": x.col.bg,
                            "--col": x.col.c,
                            background: hi ? x.col.bg : "var(--bg2)",
                            border: `1px solid ${hi ? x.col.line : "var(--line)"}`,
                            borderRadius: 16,
                            padding: "14px 12px 12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            alignItems: "center",
                            textAlign: "center",
                            cursor: closed ? "default" : "pointer",
                            color: "var(--text)",
                            minWidth: 0,
                          } as CSSProperties
                        }
                      >
                        <span
                          style={{ fontSize: 12.5, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}
                        >
                          {x.label}
                        </span>
                        <span style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.15, color: x.k === "draw" ? "var(--text)" : x.col.c }}>
                          {settled ? (won ? "برد" : "—") : faPct(x.o.p)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {!settled && (
                  <>
                    <div style={{ display: "flex", gap: 3, height: 6 }} aria-hidden>
                      {outs.map((x) => (
                        <span key={`${x.o.slug}-${x.o.label}-bar`} style={{ flex: Math.max(x.pct, 1), background: x.col.c, borderRadius: 3, transition: "flex .6s" }} />
                      ))}
                    </div>
                    {p.resultVol24 > 0 && (
                      <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.8 }}>
                        پشتوانه: {faMoney(p.resultVol24)} معامله روی نتیجه در ۲۴ ساعت گذشته.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>

          {whales && whales.whale_bet_count > 0 && names && (
            <Link
              href="/big-games"
              className="pb-card-link"
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 18,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                color: "var(--text)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>نهنگ‌ها روی این بازی</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {fa(whales.whale_bet_count)} پیش‌بینی بزرگ · {faMoney(whales.whale_total_usdc)}
                </span>
                <span style={{ marginInlineStart: "auto", color: "var(--gold)", fontSize: 13, fontWeight: 700 }}>همه ←</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "var(--text2)" }}>
                {topWhales.map((w) => {
                  const t = tierOf(w.stats);
                  return (
                    <div key={`${w.wallet}-${w.market.id}-${w.outcome_index}`} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={{ fontWeight: 800, color: t.c, width: 22, flexShrink: 0 }}>{w.stats?.score === null || !w.stats ? "—" : fa(w.stats.score)}</span>
                      <span dir="ltr" style={{ fontWeight: 700, color: "var(--text)", flexShrink: 0 }}>
                        {whaleName(w)}
                      </span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {faMoney(w.amount_usdc)} روی {betLabel(w, names, enSideNames(whales))} در {faPct(w.avg_price)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Link>
          )}

          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>همهٔ بازارهای این بازی</h2>
              {!closed && <span style={{ fontSize: 12, color: "var(--muted)" }}>روی هر گزینه بزنید تا پیش‌بینی کنید</span>}
            </div>
            <div
              role="tablist"
              className="pb-noscroll"
              style={{
                display: "flex",
                gap: 6,
                overflowX: "auto",
                margin: "0 -16px",
                padding: "6px 16px",
                position: "sticky",
                top: 58,
                zIndex: 6,
                background: "var(--bg)",
              }}
            >
              {p.groups.map((g) => {
                const on = g.key === cur?.key;
                return (
                  <button
                    key={g.key}
                    role="tab"
                    aria-selected={on}
                    type="button"
                    onClick={() => {
                      setTab(g.key);
                      setAll(false);
                    }}
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: 999,
                      fontSize: 13.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: `1px solid ${on ? "var(--goldline)" : "var(--line)"}`,
                      background: on ? "var(--goldbg)" : "var(--card)",
                      color: on ? "var(--gold)" : "var(--text2)",
                    }}
                  >
                    {g.label} <span style={{ fontSize: 11.5, opacity: 0.7 }}>{fa(g.rows.length)}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 18, overflow: "hidden" }}>
              {rows.map((r) => (
                <div
                  key={r.slug}
                  id={`mk-${r.slug}`}
                  className={flash === r.slug ? "pb-flash" : undefined}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "10px 14px",
                    padding: "14px 16px",
                    borderTop: "1px solid var(--line)",
                    marginTop: -1,
                  }}
                >
                  <div style={{ flex: "1 1 220px", minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.7 }}>{r.q}</span>
                    {r.h24 > 0 && r.status === "active" && (
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>حجم ۲۴ ساعت {faMoney(r.h24)}</span>
                    )}
                  </div>
                  {r.status === "active" && !ended ? (
                    <YesNoLabelled row={r} sub={sub} />
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
                      {r.outcome === "YES" ? `تسویه شد: ${r.yes}` : r.outcome === "NO" ? `تسویه شد: ${r.no}` : ended ? "در انتظار تسویه" : "بسته شد"}
                    </span>
                  )}
                </div>
              ))}
              {cur && cur.rows.length > COLLAPSED && (
                <button
                  type="button"
                  onClick={() => setAll((v) => !v)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "none",
                    borderTop: "1px solid var(--line)",
                    background: "none",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--gold)",
                    cursor: "pointer",
                  }}
                >
                  {all ? "نمایش کمتر" : `نمایش همهٔ ${fa(cur.rows.length)} بازار ${cur.label}`}
                </button>
              )}
            </div>
          </section>

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setRules((v) => !v)}
              aria-expanded={rules}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 16px",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text)",
                fontSize: 14,
                fontWeight: 700,
                textAlign: "right",
              }}
            >
              <span style={{ flex: 1 }}>قواعد تسویه</span>
              <span style={{ color: "var(--muted)", fontSize: 18 }}>{rules ? "−" : "+"}</span>
            </button>
            {rules && <div style={{ padding: "0 16px 14px", fontSize: 13.5, color: "var(--text2)", lineHeight: 1.9 }}>{p.rulesNote}</div>}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--faint)" }}>قیمت‌ها از Polymarket · به‌روزرسانی زنده</div>
        </div>

        {!closed && outs.length > 0 && sel && (
          <aside
            className="pb-aside"
            style={{
              flex: "0 0 340px",
              position: "sticky",
              top: 78,
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 22,
              padding: 18,
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800 }}>پیش‌بینی سریع</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {outs.map((x, i) => {
                const on = i === pick;
                return (
                  <button
                    key={`${x.o.slug}-${x.o.label}-aside`}
                    type="button"
                    onClick={() => setPick(i)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "11px 14px",
                      borderRadius: 12,
                      border: `1px solid ${on ? (x.k === "draw" ? "var(--line2)" : x.col.c) : "var(--line)"}`,
                      background: on ? x.col.bg : "var(--bg2)",
                      color: "var(--text)",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <span>{x.label}</span>
                    <span style={{ color: x.k === "draw" ? "var(--text)" : x.col.c, fontWeight: 800 }}>{faPct(x.o.p)}</span>
                  </button>
                );
              })}
            </div>
            <Presets amt={amt} setAmt={setAmt} small />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: "1px dashed var(--line2)", paddingTop: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>اگر درست دربیاید</span>
                <span style={{ fontSize: 22, fontWeight: 900 }}>{fa(pay.toFixed(2))} دلار</span>
              </div>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                ضریب <b style={{ color: "var(--text)" }}>×{fa(mult.toFixed(2))}</b>
              </span>
            </div>
            <PredictCtas slug={sel.o.slug} />
          </aside>
        )}
      </main>

      {!closed && outs.length > 0 && (
        <div
          className="pb-bottombar"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 30,
            background: "color-mix(in oklab, var(--bg) 90%, transparent)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            borderTop: "1px solid var(--line)",
            padding: "10px 12px calc(10px + env(safe-area-inset-bottom))",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${outs.length}, minmax(0,1fr))`, gap: 6, maxWidth: 560, margin: "0 auto" }}>
            {outs.map((x, i) => (
              <button
                key={`${x.o.slug}-${x.o.label}-bar`}
                type="button"
                onClick={() => openSide(i)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                  padding: "8px 4px",
                  borderRadius: 12,
                  border: `1px solid ${x.fav ? x.col.c : "var(--line)"}`,
                  background: x.fav ? x.col.bg : "var(--card)",
                  color: x.k === "draw" ? "var(--text)" : x.col.c,
                  cursor: "pointer",
                  minHeight: 48,
                }}
              >
                <span style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                  {x.name}
                </span>
                <span style={{ fontSize: 16, fontWeight: 900 }}>{faPct(x.o.p)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Team({ t }: { t: { name: string; logo: string | null } | null }) {
  if (!t) return <div />;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 0 }}>
      <Crest name={t.name} src={t.logo} size={64} />
      <span style={{ fontSize: 20, fontWeight: 900, textAlign: "center", lineHeight: 1.4 }}>{t.name}</span>
    </div>
  );
}

/** Yes/No for a board row, using the row's own side labels (بالاتر/پایین‌تر, team names…). */
function YesNoLabelled({ row, sub }: { row: MatchRow; sub: string }) {
  const y = pc(row.p);
  const plain = row.yes === "بله" && row.no === "خیر";
  if (plain) return <YesNo title={row.q} sub={sub} slug={row.slug} p={y} />;
  return <LabelledPair row={row} sub={sub} y={y} />;
}

function LabelledPair({ row, sub, y }: { row: MatchRow; sub: string; y: number | null }) {
  const open = usePredict();
  const base: CSSProperties = { minWidth: 84, padding: "9px 12px", borderRadius: 11, fontWeight: 800, fontSize: 13.5, cursor: "pointer" };
  const yy = y ?? 50;
  return (
    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
      <button
        type="button"
        className="pb-yes"
        onClick={() => open({ title: row.q, sub, slug: row.slug, outcome: row.yes, prob: yy })}
        style={{ ...base, border: "1px solid transparent", background: "var(--upbg)", color: "var(--up)" }}
      >
        {row.yes} {y === null ? "" : `${fa(yy)}٪`}
      </button>
      <button
        type="button"
        className="pb-no"
        onClick={() => open({ title: row.q, sub, slug: row.slug, outcome: row.no, prob: 100 - yy })}
        style={{ ...base, border: "1px solid var(--line)", background: "var(--bg2)", color: "var(--text2)" }}
      >
        {row.no} {y === null ? "" : `${fa(100 - yy)}٪`}
      </button>
    </div>
  );
}


/** «دقیقهٔ ۶۷» / «بین دو نیمه» / «پایان بازی» from Polymarket's period + clock. */
function periodLabel(l: MatchLive): string {
  if (l.status === "ended") return "پایان بازی";
  const per = String(l.period ?? "").toUpperCase();
  if (per === "HT") return "بین دو نیمه";
  const min = parseInt(String(l.elapsed ?? ""), 10);
  if (Number.isFinite(min) && min > 0) return `دقیقهٔ ${fa(min)}`;
  if (per === "1H") return "نیمهٔ اول";
  if (per === "2H") return "نیمهٔ دوم";
  if (per === "ET") return "وقت اضافه";
  if (per === "PEN") return "ضربات پنالتی";
  return "در جریان";
}
