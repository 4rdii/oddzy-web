"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Trader, TraderCat, TraderList } from "@/lib/api";
import { Avatar, ScoreRing } from "@/components/pb/ScoreRing";
import { useNow } from "@/components/pb/useNow";
import { agoOf, money, num, pctOf, type PbLang } from "@/lib/pb";
import type { Dict } from "@/lib/dict/en";

/**
 * Trader library — Polymarket traders ranked by skill rather than raw profit,
 * by category. Data: GET /traders?list=…&full=1 (oddzy-api traders.js), built
 * nightly by build-traders.mjs; the scoring is explained there and, for
 * readers, in the "how is the score calculated" panel on this page.
 *
 * Bilingual like the whales page: PolyBaaz (fa, RTL) and Oddzy (en, LTR), with
 * copy from the dictionary's `traders` section.
 */

type T = Dict["traders"];
type ListKey = keyof T["lists"];
type Filter = "all" | "copy" | "sharp" | "consistent" | "big" | "whale";
type Sort = "default" | "score" | "skill" | "roi" | "pnl" | "consistency";

/** Tab order; a list with nobody in it is not shown. */
const TABS: ListKey[] = ["all", "hot", "sports", "esports", "crypto", "politics", "geopolitics", "middle_east", "economy", "tech", "culture", "mentions", "weather", "bots"];

function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

const pct = (lang: PbLang, x: number | null | undefined) => (x === null || x === undefined ? "—" : pctOf(lang, Math.round(x * 100)));
/** "+22%" / "−4%": a return always shows its direction. */
function signedPct(lang: PbLang, x: number): string {
  const v = Math.round(x * 100);
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${pctOf(lang, Math.abs(v))}`;
}
function signedMoney(lang: PbLang, n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${money(lang, Math.abs(n))}`;
}
/** A share price: "56¢" / «۵۶ سنت». */
function cents(lang: PbLang, p: number): string {
  const c = Math.round(p * 100);
  return lang === "fa" ? `${num(lang, c)} سنت` : `${c}¢`;
}
const scoreColor = (s: number) => (s >= 65 ? "var(--up)" : s >= 45 ? "var(--gold)" : s >= 25 ? "var(--blue)" : "var(--faint)");
const shortWallet = (w: string) => `${w.slice(0, 6)}…${w.slice(-4)}`;
const nameOf = (tr: Trader, t: T) => tr.name ?? fill(t.anon, { short: shortWallet(tr.wallet) });

const LABEL_TONE: Record<string, "up" | "gold" | "warn" | "mute"> = {
  sharp: "up",
  hot_streak: "up",
  consistent: "up",
  specialist: "gold",
  generalist: "gold",
  whale: "gold",
  longshot_hunter: "gold",
  cooling: "warn",
  one_big_win: "warn",
  small_sample: "warn",
  favourite_sweeper: "warn",
  candle_trader: "warn",
  in_out_trader: "warn",
  bot: "mute",
  market_maker: "mute",
};
const TONE = {
  up: { c: "var(--up)", bg: "var(--upbg)" },
  gold: { c: "var(--gold)", bg: "var(--goldbg)" },
  warn: { c: "var(--down)", bg: "var(--downbg)" },
  mute: { c: "var(--muted)", bg: "var(--bg2)" },
};

function passes(f: Filter, tr: Trader): boolean {
  if (f === "copy") return tr.copy_grade === "easy";
  if (f === "sharp") return tr.labels.includes("sharp");
  if (f === "consistent") return tr.labels.includes("consistent");
  if (f === "big") return tr.stats.median_bet >= 100;
  if (f === "whale") return tr.labels.includes("whale");
  return true;
}
const SORT_KEY: Record<Exclude<Sort, "default">, (tr: Trader) => number> = {
  score: (tr) => tr.score,
  skill: (tr) => tr.skill,
  roi: (tr) => tr.stats.roi,
  pnl: (tr) => tr.stats.pnl,
  consistency: (tr) => tr.consistency,
};

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: "8px 14px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        border: `1px solid ${on ? "var(--goldline)" : "var(--line)"}`,
        background: on ? "var(--goldbg)" : "var(--card)",
        color: on ? "var(--gold)" : "var(--text2)",
      }}
    >
      {children}
    </button>
  );
}

/** Cumulative profit as a tiny line: green when it ends above where it started. */
function Spark({ points, w = 76, h = 26 }: { points: number[]; w?: number; h?: number }) {
  if (points.length < 3) return <span style={{ width: w, height: h, display: "inline-block" }} />;
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const span = hi - lo || 1;
  const d = points.map((v, i) => `${((i / (points.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`).join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden style={{ flexShrink: 0, direction: "ltr" }}>
      <polyline points={d} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** One component of the score: name, 0–100 bar, and the plain-words reading. */
function Part({ label, value, hint, lang }: { label: string; value: number; hint: string; lang: PbLang }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
        <span style={{ fontWeight: 700 }}>{label}</span>
        <span style={{ fontWeight: 800, color: scoreColor(v) }}>{num(lang, v)}</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "var(--bg2)", overflow: "hidden" }}>
        <div style={{ width: `${v}%`, height: "100%", borderRadius: 999, background: scoreColor(v) }} />
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--muted)" }}>{hint}</div>
    </div>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: "up" | "down" }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
      <span style={{ color: "var(--muted)" }}>{k}</span>
      <span style={{ fontWeight: 700, color: tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--text)" }}>{v}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{children}</h3>;
}

function Detail({ tr, lang, t, now }: { tr: Trader; lang: PbLang; t: T; now: number | null }) {
  const s = tr.stats;
  const cats = (Object.entries(tr.cats) as [string, TraderCat][])
    .filter(([k, c]) => k !== "middle_east" && c.share >= 0.03)
    .sort((a, b) => b[1].share - a[1].share)
    .slice(0, 6);
  const catName = (k: string) => (t.lists as Record<string, string>)[k] ?? k;
  const lastIso = s.last_trade_at ? new Date(s.last_trade_at * 1000).toISOString() : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, padding: "4px 16px 18px", borderTop: "1px solid var(--line)" }}>
      <section style={{ paddingTop: 16 }}>
        <SectionTitle>{t.partsTitle}</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "16px 22px" }}>
          <Part
            lang={lang}
            label={t.skill}
            value={tr.skill}
            hint={s.z_eff > 0 ? fill(t.skillHint, { z: num(lang, s.z_eff.toFixed(1)) }) : t.skillHintNone}
          />
          <Part lang={lang} label={t.consistency} value={tr.consistency} hint={fill(t.consistencyHint, { pct: pct(lang, s.weekly_hit), weeks: num(lang, s.weeks) })} />
          <Part lang={lang} label={t.spread} value={tr.spread} hint={fill(t.spreadHint, { pct: pct(lang, s.top1_share) })} />
          <Part lang={lang} label={t.calm} value={tr.calm} hint={fill(t.calmHint, { pct: pct(lang, Math.min(s.max_dd_pct, 1)) })} />
          <Part lang={lang} label={t.copyability} value={tr.copy} hint={t.copy[tr.copy_grade]} />
        </div>
      </section>

      {tr.copy_why.length > 0 && (
        <section>
          <SectionTitle>{t.whyTitle}</SectionTitle>
          <ul style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 6, fontSize: 13, lineHeight: 1.8, color: "var(--text2)" }}>
            {tr.copy_why.map((w) => (
              <li key={w}>{(t.why as Record<string, string>)[w] ?? w}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle>{t.trackTitle}</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", columnGap: 22 }}>
          <Stat k={t.profit} v={signedMoney(lang, s.pnl)} tone={s.pnl >= 0 ? "up" : "down"} />
          <Stat k={t.staked} v={money(lang, s.staked)} />
          <Stat k={t.roi} v={signedPct(lang, s.roi)} tone={s.roi >= 0 ? "up" : "down"} />
          <Stat k={t.events} v={num(lang, s.events)} />
          <Stat k={t.winRate} v={pct(lang, s.win_rate)} />
          <Stat k={t.profitFactor} v={lang === "fa" ? `${num(lang, s.profit_factor.toFixed(2))} دلار` : `$${s.profit_factor.toFixed(2)}`} />
          <Stat k={t.avgEntry} v={cents(lang, s.avg_entry)} />
          <Stat k={t.medianBet} v={money(lang, s.median_bet)} />
          <Stat k={t.tradesPerDay} v={num(lang, Math.round(s.trades_per_day))} />
          <Stat k={t.lastTrade} v={lastIso && now !== null ? agoOf(lang, lastIso, now) : "—"} />
          <Stat k={t.allTime} v={signedMoney(lang, s.all_time_pnl)} tone={s.all_time_pnl >= 0 ? "up" : "down"} />
          <Stat
            k={t.form30}
            v={tr.hot.events > 0 ? fill(t.form30Row, { n: num(lang, tr.hot.events), money: signedMoney(lang, tr.hot.pnl), roi: signedPct(lang, tr.hot.roi) }) : "—"}
            tone={tr.hot.events > 0 ? (tr.hot.pnl >= 0 ? "up" : "down") : undefined}
          />
        </div>
      </section>

      {cats.length > 0 && (
        <section>
          <SectionTitle>{t.catsTitle}</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cats.map(([k, c]) => (
              <div key={k} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700 }}>{catName(k)}</span>
                  <span style={{ color: "var(--muted)" }}>
                    {fill(t.catRow, { share: pct(lang, c.share), roi: signedPct(lang, c.roi), n: num(lang, c.events) })}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "var(--bg2)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.round(c.share * 100)}%`, height: "100%", borderRadius: 999, background: c.pnl >= 0 ? "var(--up)" : "var(--down)" }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle>{t.holdingTitle}</SectionTitle>
        {tr.holding.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{t.holdingNone}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tr.holding.map((h) => {
              const href = h.ours ? (h.our_event_kind === "match" && h.our_event_slug ? `/match/${h.our_event_slug}` : `/market/${h.slug}`) : null;
              return (
                <div
                  key={`${h.slug}:${h.outcome}`}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--card2)" }}
                >
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.6 }} dir="auto">
                      {h.title}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
                      {fill(t.holdRow, { outcome: h.outcome, avg: cents(lang, h.avg_price), price: cents(lang, h.price) })}
                      {" · "}
                      {money(lang, h.value)}
                    </div>
                  </div>
                  {href && (
                    <Link href={href} className="pb-gold-btn" style={{ flexShrink: 0, fontSize: 13, fontWeight: 800, padding: "8px 14px", borderRadius: 10 }}>
                      {t.tradeHere}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <a
        href={`https://polymarket.com/profile/${tr.wallet}`}
        target="_blank"
        rel="noopener noreferrer nofollow"
        style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textDecoration: "underline", alignSelf: "flex-start" }}
      >
        {t.onPolymarket} ↗
      </a>
    </div>
  );
}

function Row({ tr, rank, open, onToggle, list, lang, t, now }: { tr: Trader; rank: number; open: boolean; onToggle: () => void; list: string; lang: PbLang; t: T; now: number | null }) {
  // On a category list the headline numbers are the category's own record.
  const c = tr.cat;
  const roi = c ? c.roi : list === "hot" ? tr.hot.roi : tr.stats.roi;
  const events = c ? c.events : list === "hot" ? tr.hot.events : tr.stats.events;
  const winRate = c ? c.win_rate : list === "hot" ? (tr.hot.win_rate ?? tr.stats.win_rate) : tr.stats.win_rate;
  // The ring is the score this list is ranked by: the category's own on a
  // category list, the 30-day one on "in form", the overall one elsewhere.
  const ring = Math.round((c ? c.score : list === "hot" ? tr.hot.score : undefined) ?? tr.score);
  const catName = (k: string | null) => (k ? ((t.lists as Record<string, string>)[k] ?? k) : "");
  const labels = tr.labels.slice(0, 3);
  const name = nameOf(tr, t);
  const copyTone = tr.copy_grade === "easy" ? TONE.up : tr.copy_grade === "moderate" ? TONE.gold : TONE.warn;
  return (
    <article style={{ borderRadius: 16, border: `1px solid ${open ? "var(--goldline)" : "var(--line)"}`, background: "var(--card)", overflow: "hidden" }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="pb-row"
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 14px", cursor: "pointer", border: 0, background: "transparent", color: "inherit", textAlign: "start", font: "inherit" }}
      >
        <span style={{ width: 22, flexShrink: 0, fontSize: 13, fontWeight: 800, color: "var(--faint)", textAlign: "center" }}>{num(lang, rank)}</span>
        <Avatar name={name} src={tr.image} size={38} />
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} dir="auto">
              {name}
            </span>
          </span>
          <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {labels.map((l) => {
              const tone = TONE[LABEL_TONE[l] ?? "mute"];
              const text = fill((t.labels as Record<string, string>)[l] ?? l, { cat: catName(tr.main_cat) });
              return (
                <span key={l} style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, color: tone.c, background: tone.bg }}>
                  {text}
                </span>
              );
            })}
            {!tr.is_bot && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, color: copyTone.c, background: copyTone.bg }}>{t.copy[tr.copy_grade]}</span>
            )}
          </span>
          <span style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", fontSize: 12, color: "var(--muted)" }}>
            <span>
              {t.roi} <b style={{ color: roi >= 0 ? "var(--up)" : "var(--down)" }}>{signedPct(lang, roi)}</b>
            </span>
            <span>
              {t.winRate} <b style={{ color: "var(--text2)" }}>{pct(lang, winRate)}</b>
            </span>
            <span>{fill(t.bets, { n: num(lang, events) })}</span>
            <span>{fill(t.typicalBet, { money: money(lang, tr.stats.median_bet) })}</span>
          </span>
        </span>
        <span className="pb-spark" style={{ display: "flex" }}>
          <Spark points={tr.spark} />
        </span>
        <ScoreRing score={ring} color={scoreColor(ring)} lang={lang} />
      </button>
      {open && <Detail tr={tr} lang={lang} t={t} now={now} />}
    </article>
  );
}

export function TradersPb({ data, list, lang = "fa", t }: { data: TraderList | null; list: string; lang?: PbLang; t: T }) {
  const now = useNow(60_000);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("default");
  const [openWallet, setOpenWallet] = useState<string | null>(null);
  const [how, setHow] = useState(false);

  const all = useMemo(() => data?.traders ?? [], [data]);
  const rows = useMemo(() => {
    const f = all.filter((tr) => passes(filter, tr));
    return sort === "default" ? f : [...f].sort((a, b) => SORT_KEY[sort](b) - SORT_KEY[sort](a));
  }, [all, filter, sort]);

  const counts = data?.counts ?? {};
  const tabs = TABS.filter((k) => k === "all" || k === list || (counts[k] ?? 0) > 0);
  const listName = (t.lists as Record<string, string>)[list] ?? list;
  const isCategory = !["all", "hot", "bots", "middle_east"].includes(list);
  const listIntro =
    list === "all" ? null : list === "hot" ? t.listIntro.hot : list === "bots" ? t.listIntro.bots : list === "middle_east" ? t.listIntro.middle_east : fill(t.listIntro.category, { cat: listName });
  const filters: [Filter, string][] = [
    ["all", t.filterAll],
    ["copy", t.filterCopy],
    ["sharp", t.filterSharp],
    ["consistent", t.filterConsistent],
    ["big", t.filterBig],
    ["whale", t.filterWhale],
  ];
  const sorts: [Sort, string][] = [
    ["default", isCategory || list === "hot" ? t.sortSkill : t.sortScore],
    ...(isCategory || list === "hot" ? ([["score", t.sortScore]] as [Sort, string][]) : ([["skill", t.sortSkill]] as [Sort, string][])),
    ["roi", t.sortRoi],
    ["pnl", t.sortPnl],
    ["consistency", t.sortConsistency],
  ];

  return (
    <div dir={lang === "en" ? "ltr" : "rtl"} className="pb">
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "24px 16px 60px", display: "flex", flexDirection: "column", gap: 18 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
            {data?.built_at && now !== null && <span>{fill(t.updated, { ago: agoOf(lang, data.built_at, now) })}</span>}
            {data?.analysed ? (
              <>
                <span style={{ color: "var(--faint)" }}>·</span>
                <span>{fill(t.analysed, { n: num(lang, data.analysed) })}</span>
              </>
            ) : null}
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.35 }}>{list === "all" ? t.title : fill(t.titleList, { cat: listName })}</h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.9, color: "var(--text2)", maxWidth: 640, textWrap: "pretty" }}>{listIntro ?? t.intro}</p>
        </header>

        <nav className="pb-noscroll" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -16px", padding: "0 16px" }}>
          {tabs.map((k) => {
            const on = k === list;
            return (
              <Link
                key={k}
                href={k === "all" ? "/traders" : `/traders/${k}`}
                aria-current={on ? "page" : undefined}
                style={{
                  flexShrink: 0,
                  padding: "9px 16px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 800,
                  border: `1px solid ${on ? "var(--gold)" : "var(--line)"}`,
                  background: on ? "var(--gold)" : "var(--card)",
                  color: on ? "var(--goldink)" : "var(--text2)",
                }}
              >
                {(t.lists as Record<string, string>)[k]}
              </Link>
            );
          })}
        </nav>

        <section style={{ borderRadius: 14, border: "1px solid var(--line)", background: "var(--card)", padding: "12px 14px" }}>
          <button
            type="button"
            onClick={() => setHow((v) => !v)}
            aria-expanded={how}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, border: 0, background: "transparent", color: "var(--text)", cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 800, textAlign: "start", padding: 0 }}
          >
            <span>{t.howOpen}</span>
            <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>{how ? t.howClose : "+"}</span>
          </button>
          {how && (
            <ol style={{ margin: "12px 0 2px", paddingInlineStart: 20, display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5, lineHeight: 1.95, color: "var(--text2)" }}>
              {t.how.map((line, i) => (
                <li key={i}>
                  {fill(line, {
                    events: num(lang, data?.thresholds?.min_events ?? 25),
                    money: money(lang, data?.thresholds?.min_staked ?? 5000),
                  })}
                </li>
              ))}
            </ol>
          )}
        </section>

        {all.length > 0 && list !== "bots" && (
          <div className="pb-noscroll" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -16px", padding: "0 16px" }}>
            {filters.map(([k, label]) => (
              <Chip key={k} on={k === filter} onClick={() => setFilter(k)}>
                {label}
              </Chip>
            ))}
          </div>
        )}
        {all.length > 1 && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)" }}>
            {t.sortBy}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", font: "inherit", fontSize: 13, fontWeight: 700 }}
            >
              {sorts.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}

        {all.length === 0 ? (
          <div style={{ padding: "40px 16px", textAlign: "center", fontSize: 14, color: "var(--muted)", border: "1px dashed var(--line2)", borderRadius: 16 }}>
            {data?.built_at ? t.emptyList : t.empty}
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center", fontSize: 14, color: "var(--muted)", border: "1px dashed var(--line2)", borderRadius: 16 }}>{t.emptyFilter}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((tr, i) => (
              <Row
                key={tr.wallet}
                tr={tr}
                rank={i + 1}
                open={openWallet === tr.wallet}
                onToggle={() => setOpenWallet((w) => (w === tr.wallet ? null : tr.wallet))}
                list={list}
                lang={lang}
                t={t}
                now={now}
              />
            ))}
          </div>
        )}

        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.9, color: "var(--faint)" }}>{t.disclaimer}</p>
      </main>
    </div>
  );
}
