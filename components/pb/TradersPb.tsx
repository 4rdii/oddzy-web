"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Trader, TraderCat, TraderList } from "@/lib/api";
import { Avatar, ScoreRing } from "@/components/pb/ScoreRing";
import { useNow } from "@/components/pb/useNow";
import { agoOf, dayMonthOf, money, num, pctOf, type PbLang } from "@/lib/pb";
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
function Spark({ points, w = 76, h = 26, fluid = false }: { points: number[]; w?: number; h?: number; fluid?: boolean }) {
  if (points.length < 3) return <span style={{ width: fluid ? "100%" : w, height: h, display: "inline-block" }} />;
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const span = hi - lo || 1;
  const d = points.map((v, i) => `${((i / (points.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`).join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg
      width={fluid ? "100%" : w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio={fluid ? "none" : undefined}
      aria-hidden
      style={{ flexShrink: 0, direction: "ltr", display: "block" }}
    >
      <polyline
        points={d}
        fill="none"
        stroke={up ? "var(--up)" : "var(--down)"}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
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

function Stat({ k, v, tone, wide }: { k: string; v: string; tone?: "up" | "down"; wide?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13, gridColumn: wide ? "1 / -1" : undefined }}>
      <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{k}</span>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {tr.spark.length >= 3 && (
        <section>
          <SectionTitle>{t.curveTitle}</SectionTitle>
          <div style={{ padding: "12px 12px 8px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--card2)" }}>
            <Spark points={tr.spark} w={600} h={84} fluid />
          </div>
        </section>
      )}
      <section>
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
        {/* A very active wallet's record is read back only as far as the page
            cap reaches; say which period the numbers cover. */}
        <SectionTitle>
          {s.truncated && s.covered_from ? fill(t.trackTitleSince, { date: dayMonthOf(lang, new Date(s.covered_from * 1000).toISOString()) }) : t.trackTitle}
        </SectionTitle>
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
            wide
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

/** The numbers a row leads with: the list's own record where the list has one. */
function headline(tr: Trader, list: string) {
  const c = tr.cat;
  const hot = list === "hot";
  return {
    roi: c ? c.roi : hot ? tr.hot.roi : tr.stats.roi,
    events: c ? c.events : hot ? tr.hot.events : tr.stats.events,
    winRate: c ? c.win_rate : hot ? (tr.hot.win_rate ?? tr.stats.win_rate) : tr.stats.win_rate,
    // The ring is the score this list is ranked by: the category's own on a
    // category list, the 30-day one on "in form", the overall one elsewhere.
    ring: Math.round((c ? c.score : hot ? tr.hot.score : undefined) ?? tr.score),
  };
}

function Labels({ tr, t, max }: { tr: Trader; t: T; max: number }) {
  const catName = (k: string | null) => (k ? ((t.lists as Record<string, string>)[k] ?? k) : "");
  const copyTone = tr.copy_grade === "easy" ? TONE.up : tr.copy_grade === "moderate" ? TONE.gold : TONE.warn;
  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {tr.labels.slice(0, max).map((l) => {
        const tone = TONE[LABEL_TONE[l] ?? "mute"];
        const text = fill((t.labels as Record<string, string>)[l] ?? l, { cat: catName(tr.main_cat) });
        return (
          <span key={l} style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, color: tone.c, background: tone.bg }}>
            {text}
          </span>
        );
      })}
      {!tr.is_bot && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, color: copyTone.c, background: copyTone.bg }}>{t.copy[tr.copy_grade]}</span>}
    </span>
  );
}

function HeadStats({ tr, list, lang, t }: { tr: Trader; list: string; lang: PbLang; t: T }) {
  const h = headline(tr, list);
  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", fontSize: 12, color: "var(--muted)" }}>
      <span>
        {t.roi} <b style={{ color: h.roi >= 0 ? "var(--up)" : "var(--down)" }}>{signedPct(lang, h.roi)}</b>
      </span>
      <span>
        {t.winRate} <b style={{ color: "var(--text2)" }}>{pct(lang, h.winRate)}</b>
      </span>
      <span>{fill(t.bets, { n: num(lang, h.events) })}</span>
      <span>{fill(t.typicalBet, { money: money(lang, tr.stats.median_bet) })}</span>
    </span>
  );
}

function Row({ tr, rank, onOpen, list, lang, t }: { tr: Trader; rank: number; onOpen: () => void; list: string; lang: PbLang; t: T }) {
  const name = nameOf(tr, t);
  const ring = headline(tr, list).ring;
  return (
    <article style={{ borderRadius: 16, border: "1px solid var(--line)", background: "var(--card)", overflow: "hidden" }}>
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        className="pb-row"
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 14px", cursor: "pointer", border: 0, background: "transparent", color: "inherit", textAlign: "start", font: "inherit" }}
      >
        <span style={{ width: 22, flexShrink: 0, fontSize: 13, fontWeight: 800, color: "var(--faint)", textAlign: "center" }}>{num(lang, rank)}</span>
        <Avatar name={name} src={tr.image} size={38} />
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} dir="auto">
            {name}
          </span>
          <Labels tr={tr} t={t} max={3} />
          <HeadStats tr={tr} list={list} lang={lang} t={t} />
        </span>
        <span className="pb-spark" style={{ display: "flex" }}>
          <Spark points={tr.spark} />
        </span>
        <ScoreRing score={ring} color={scoreColor(ring)} lang={lang} />
      </button>
    </article>
  );
}

/**
 * A trader's full record, over the list: a centred dialog on desktop, a sheet
 * rising from the bottom on a phone (see .tl-dialog* in globals.css). The list
 * underneath keeps its scroll position, which the old in-place expansion lost
 * whenever a long record pushed the next rows off the screen.
 */
function TraderDialog({ tr, rank, list, lang, t, now, onClose }: { tr: Trader; rank: number; list: string; lang: PbLang; t: T; now: number | null; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    // The page behind must not scroll while the dialog does.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  const name = nameOf(tr, t);
  const ring = headline(tr, list).ring;
  return (
    <div className="tl-dialog-wrap" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={name} className="tl-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="tl-dialog-head">
          <span style={{ width: 22, flexShrink: 0, fontSize: 13, fontWeight: 800, color: "var(--faint)", textAlign: "center" }}>{num(lang, rank)}</span>
          <Avatar name={name} src={tr.image} size={46} />
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
            <span style={{ fontSize: 18, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} dir="auto">
              {name}
            </span>
            <Labels tr={tr} t={t} max={5} />
            <HeadStats tr={tr} list={list} lang={lang} t={t} />
          </span>
          <ScoreRing score={ring} color={scoreColor(ring)} size={58} lang={lang} />
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            style={{ alignSelf: "flex-start", flexShrink: 0, width: 34, height: 34, borderRadius: 10, border: "1px solid var(--line)", background: "var(--card2)", color: "var(--text2)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
          >
            ✕
          </button>
        </header>
        <div className="tl-dialog-body">
          <Detail tr={tr} lang={lang} t={t} now={now} />
        </div>
      </div>
    </div>
  );
}

function SideTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--faint)", padding: "0 10px 6px" }}>{children}</div>;
}

/** One line of a left-panel group: a list link, a filter, or a sort order. */
const sideItem = (on: boolean): React.CSSProperties => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "8px 10px",
  borderRadius: 10,
  border: 0,
  cursor: "pointer",
  font: "inherit",
  fontSize: 14,
  fontWeight: on ? 800 : 600,
  textAlign: "start",
  background: on ? "var(--goldbg)" : "transparent",
  color: on ? "var(--gold)" : "var(--text2)",
});

function HowList({ data, lang, t }: { data: TraderList | null; lang: PbLang; t: T }) {
  return (
    <ol style={{ margin: 0, paddingInlineStart: 20, display: "flex", flexDirection: "column", gap: 10, fontSize: 13, lineHeight: 1.9, color: "var(--text2)" }}>
      {t.how.map((line, i) => (
        <li key={i}>
          {fill(line, {
            events: num(lang, data?.thresholds?.min_events ?? 25),
            money: money(lang, data?.thresholds?.min_staked ?? 5000),
          })}
        </li>
      ))}
    </ol>
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
  const openIndex = openWallet ? rows.findIndex((tr) => tr.wallet === openWallet) : -1;

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
  const ownRanking = isCategory || list === "hot" || list === "middle_east";
  const sorts: [Sort, string][] = [
    ["default", ownRanking ? t.sortSkill : t.sortScore],
    ...(ownRanking ? ([["score", t.sortScore]] as [Sort, string][]) : ([["skill", t.sortSkill]] as [Sort, string][])),
    ["roi", t.sortRoi],
    ["pnl", t.sortPnl],
    ["consistency", t.sortConsistency],
  ];
  const showFilters = all.length > 0 && list !== "bots";
  const hrefOf = (k: string) => (k === "all" ? "/traders" : `/traders/${k}`);

  return (
    <div dir={lang === "en" ? "ltr" : "rtl"} className="pb">
      <div className="tl-shell">
        {/* Left panel (desktop): lists, filters, sort. On a phone the same
            controls are the chip rows inside the main column. */}
        <aside className="tl-side" aria-label={t.sideLists}>
          <nav>
            <SideTitle>{t.sideLists}</SideTitle>
            {tabs.map((k) => (
              <Link key={k} href={hrefOf(k)} aria-current={k === list ? "page" : undefined} style={sideItem(k === list)}>
                <span>{(t.lists as Record<string, string>)[k]}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: k === list ? "var(--gold)" : "var(--faint)" }}>{num(lang, counts[k] ?? 0)}</span>
              </Link>
            ))}
          </nav>
          {showFilters && (
            <div>
              <SideTitle>{t.sideShow}</SideTitle>
              {filters.map(([k, label]) => (
                <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={k === filter} style={sideItem(k === filter)}>
                  <span>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: k === filter ? "var(--gold)" : "var(--faint)" }}>{num(lang, all.filter((tr) => passes(k, tr)).length)}</span>
                </button>
              ))}
            </div>
          )}
          {all.length > 1 && (
            <div>
              <SideTitle>{t.sortBy}</SideTitle>
              {sorts.map(([k, label]) => (
                <button key={k} type="button" onClick={() => setSort(k)} aria-pressed={k === sort} style={sideItem(k === sort)}>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <main style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
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

          <nav className="pb-noscroll tl-mobile" style={{ gap: 8, overflowX: "auto", margin: "0 -16px", padding: "0 16px" }}>
            {tabs.map((k) => {
              const on = k === list;
              return (
                <Link
                  key={k}
                  href={hrefOf(k)}
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

          {/* Shown until the right panel exists (under 1280px). */}
          <section className="tl-how-inline" style={{ borderRadius: 14, border: "1px solid var(--line)", background: "var(--card)", padding: "12px 14px" }}>
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
              <div style={{ marginTop: 12 }}>
                <HowList data={data} lang={lang} t={t} />
              </div>
            )}
          </section>

          {showFilters && (
            <div className="pb-noscroll tl-mobile" style={{ gap: 8, overflowX: "auto", margin: "0 -16px", padding: "0 16px" }}>
              {filters.map(([k, label]) => (
                <Chip key={k} on={k === filter} onClick={() => setFilter(k)}>
                  {label}
                </Chip>
              ))}
            </div>
          )}
          {all.length > 1 && (
            <label className="tl-mobile" style={{ alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)" }}>
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
                <Row key={tr.wallet} tr={tr} rank={i + 1} onOpen={() => setOpenWallet(tr.wallet)} list={list} lang={lang} t={t} />
              ))}
            </div>
          )}

          <p className="tl-disclaimer-inline" style={{ margin: 0, fontSize: 12, lineHeight: 1.9, color: "var(--faint)" }}>
            {t.disclaimer}
          </p>
        </main>

        {/* Right panel (wide desktop): how the score works, always open. */}
        <aside className="tl-aside" aria-label={t.howOpen}>
          <section style={{ borderRadius: 14, border: "1px solid var(--line)", background: "var(--card)", padding: "16px 16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{t.howOpen}</h2>
            <HowList data={data} lang={lang} t={t} />
          </section>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.9, color: "var(--faint)" }}>{t.disclaimer}</p>
        </aside>
      </div>

      {openIndex >= 0 && <TraderDialog tr={rows[openIndex]} rank={openIndex + 1} list={list} lang={lang} t={t} now={now} onClose={() => setOpenWallet(null)} />}
    </div>
  );
}
