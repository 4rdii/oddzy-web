"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import type { MatchLive, SideKey, WhaleBet, WhaleGame, WhaleSport } from "@/lib/api";
import { Crest } from "@/components/pb/Crest";
import { useNow, useTimeZone } from "@/components/pb/useNow";
import { Avatar, ScoreRing } from "@/components/pb/ScoreRing";
import { betLabel, enSideNames, entryPct, sideNames, sideOutcome, tagOf, tierOf, whaleName } from "@/components/pb/whale";
import { agoOf, dayOf, money, num, pc, pctOf, probPct, SIDE_COLOR, timeOf, type PbLang } from "@/lib/pb";
import type { Dict } from "@/lib/dict/en";

/**
 * PB Big Games Whales — today's five most-traded matches and the biggest
 * pre-match bets on each, with every bettor's 0–100 track-record score.
 * Data: GET /whales/today (oddzy-api, whales.js).
 *
 * Bilingual: PolyBaaz (fa, RTL, Tehran time) and Oddzy (en, LTR, the viewer's
 * own zone). Copy comes from the dictionary's `whales` section as `t`.
 */

type T = Dict["whales"];

/** "{n} bets" templates: replace each `{key}`. */
function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

type Filter = "all" | "sharp" | "contra" | "weak";

const filtersOf = (t: T): [Filter, string][] => [
  ["all", t.filterAll],
  ["sharp", t.filterSharp],
  ["contra", t.filterContra],
  ["weak", t.filterWeak],
];

function passes(f: Filter, b: WhaleBet): boolean {
  const s = b.stats;
  const isNew = s?.tier === "new";
  if (f === "sharp") return !!b.sharp || (!!s && !isNew && (s.score ?? 0) >= 80);
  if (f === "contra") return Math.round(b.avg_price * 100) <= 30;
  if (f === "weak") return !!s && !isNew && s.score !== null && s.score < 40;
  return true;
}

type Sel = { bet: WhaleBet; game: WhaleGame; names: Record<SideKey, string> };

export function WhalesPb({
  games: initialGames,
  finished: initialFinished = [],
  sports = [],
  generatedAt,
  dateLabel,
  dateIso,
  lang = "fa",
  t,
}: {
  games: WhaleGame[];
  /** Today's games that have ended: listed after the top 5, collapsed, with their score. */
  finished?: WhaleGame[];
  /** Sports with games today; the page filters by one, football by default. */
  sports?: WhaleSport[];
  generatedAt: string | null;
  dateLabel: string;
  /** The instant `dateLabel` was made from; en re-formats it in the viewer's zone. */
  dateIso?: string;
  lang?: PbLang;
  t: T;
}) {
  const tz = useTimeZone(lang);
  const day = lang === "en" && dateIso ? dayOf(lang, dateIso, tz) : dateLabel;
  const fmt = { lang, tz, t };
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });
  const [how, setHow] = useState(false);
  const [sel, setSel] = useState<Sel | null>(null);
  const now = useNow(60_000);
  const ended = useEndedWatch(initialGames);

  // A game the live feed reports as ended leaves the ranking at once and joins
  // the finished list with its score — no page rebuild needed.
  const [sport, setSport] = useState(sports.some((x) => x.slug === "football") ? "football" : (sports[0]?.slug ?? "all"));
  const inSport = (g: WhaleGame) => sport === "all" || (g.sport?.slug ?? "football") === sport;
  const games = initialGames.filter((g) => !ended[g.slug] && inSport(g));
  const finished = [
    ...initialGames.filter((g) => ended[g.slug] && inSport(g)).map((g) => ({ ...g, live: ended[g.slug] })),
    ...initialFinished.filter(inSport),
  ];

  const allBets = games.reduce((a, g) => a + g.whale_bet_count, 0);
  const allMoney = games.reduce((a, g) => a + (g.whale_total_usdc ?? 0), 0);

  return (
    <div dir={lang === "en" ? "ltr" : "rtl"} className="pb">
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "24px 16px 60px", display: "flex", flexDirection: "column", gap: 20 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--up)", fontWeight: 700 }}>
              <span className="pb-pulse" /> {t.live}
            </span>
            <span style={{ color: "var(--faint)" }}>·</span>
            <span>{day}</span>
            {generatedAt && now !== null && (
              <>
                <span style={{ color: "var(--faint)" }}>·</span>
                <span>{fill(t.updated, { ago: agoOf(lang, generatedAt, now) })}</span>
              </>
            )}
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.35 }}>{t.title}</h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.9, color: "var(--text2)", maxWidth: 620, textWrap: "pretty" }}>
            {t.intro}
          </p>
          {games.length > 0 && (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              {fill(t.summary, { games: num(lang, games.length), bets: num(lang, allBets), money: money(lang, allMoney) })}
            </div>
          )}
        </header>

        {sports.length > 1 && (
          <div className="pb-noscroll" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -16px", padding: "0 16px" }}>
            {sports.map((x) => {
              const on = x.slug === sport;
              return (
                <button
                  key={x.slug}
                  type="button"
                  onClick={() => {
                    setSport(x.slug);
                    setOpen({ 0: true });
                  }}
                  style={{
                    flexShrink: 0,
                    padding: "9px 18px",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: "pointer",
                    border: `1px solid ${on ? "var(--gold)" : "var(--line)"}`,
                    background: on ? "var(--gold)" : "var(--card)",
                    color: on ? "var(--goldink)" : "var(--text2)",
                  }}
                >
                  {lang === "en" ? x.name : x.name_fa}
                </button>
              );
            })}
          </div>
        )}

        <ScoreLegend how={how} setHow={setHow} lang={lang} t={t} />

        <div className="pb-noscroll" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -16px", padding: "0 16px" }}>
          {filtersOf(t).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              style={{
                flexShrink: 0,
                padding: "8px 14px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                border: `1px solid ${k === filter ? "var(--goldline)" : "var(--line)"}`,
                background: k === filter ? "var(--goldbg)" : "var(--card)",
                color: k === filter ? "var(--gold)" : "var(--text2)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {games.map((g, gi) => (
          <GameCard
            key={g.slug}
            g={g}
            rank={gi + 1}
            open={!!open[gi]}
            toggle={() => setOpen((o) => ({ ...o, [gi]: !o[gi] }))}
            filter={filter}
            now={now}
            onSelect={setSel}
            fmt={fmt}
          />
        ))}

        {finished.length > 0 && (
          <section style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{t.finishedTitle}</h2>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{t.finishedSub}</span>
            </div>
            {finished.map((g, gi) => (
              <GameCard
                key={g.slug}
                g={g}
                rank={gi + 1}
                done
                open={!!open[100 + gi]}
                toggle={() => setOpen((o) => ({ ...o, [100 + gi]: !o[100 + gi] }))}
                filter={filter}
                now={now}
                onSelect={setSel}
                fmt={fmt}
              />
            ))}
          </section>
        )}

        {games.length < 5 && (
          <div style={{ border: "1px dashed var(--line2)", borderRadius: 16, padding: "18px 16px", display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {games.length === 0 ? t.emptyNone : fill(t.emptyFew, { n: num(lang, games.length) })}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>{t.emptyNote}</div>
            <Link href={`/topic/${sport === "all" || sport === "other" ? "football" : sport}`} style={{ fontSize: 13, fontWeight: 700 }}>
              {fill(t.allGames, { sport: (lang === "en" ? sports.find((x) => x.slug === sport)?.name : sports.find((x) => x.slug === sport)?.name_fa) ?? t.football })}
            </Link>
          </div>
        )}

        <div style={{ fontSize: 11.5, color: "var(--faint)", lineHeight: 1.9 }}>
          {t.footnote}
        </div>
      </main>
      {sel && <WhaleSheet sel={sel} onClose={() => setSel(null)} fmt={fmt} />}
    </div>
  );
}

type Fmt = { lang: PbLang; tz: string; t: T };

function ScoreLegend({ how, setHow, lang, t }: { how: boolean; setHow: (v: boolean) => void; lang: PbLang; t: T }) {
  const dot = (c: string, ring?: boolean): CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    ...(ring ? { border: `1.5px solid ${c}` } : { background: c }),
  });
  const items: [string, string, string, boolean?][] = [
    ["var(--down)", t.tierBelow, `${num(lang, 0)}–${num(lang, 39)}`],
    ["var(--muted)", t.tierAverage, `${num(lang, 40)}–${num(lang, 59)}`],
    ["var(--above)", t.tierAbove, `${num(lang, 60)}–${num(lang, 79)}`],
    ["var(--up)", t.tierSharp, `${num(lang, 80)}–${num(lang, 100)}`],
    ["var(--blue)", t.tierNew, t.provisional, true],
  ];
  return (
    <section style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 800 }}>{t.scoreTitle}</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{t.scoreScale}</span>
        <button
          type="button"
          onClick={() => setHow(!how)}
          style={{ marginInlineStart: "auto", background: "none", border: "none", color: "var(--gold)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}
        >
          {how ? t.close : t.howOpen}
        </button>
      </div>
      <div style={{ display: "flex", gap: 3, height: 6 }} aria-hidden>
        <span style={{ flex: 40, background: "var(--down)", borderRadius: 3 }} />
        <span style={{ flex: 20, background: "var(--muted)", borderRadius: 3 }} />
        <span style={{ flex: 20, background: "var(--above)", borderRadius: 3 }} />
        <span style={{ flex: 21, background: "var(--up)", borderRadius: 3 }} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 12, color: "var(--text2)" }}>
        {items.map(([c, l, r, ring]) => (
          <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={dot(c, ring)} />
            {l} <span style={{ color: "var(--faint)" }}>{r}</span>
          </span>
        ))}
      </div>
      {how && (
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.9, color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: 11, textWrap: "pretty" }}>
          {t.howText}
        </p>
      )}
    </section>
  );
}

function GameCard({
  g,
  rank,
  done,
  open,
  toggle,
  filter,
  now,
  onSelect,
  fmt,
}: {
  g: WhaleGame;
  rank: number;
  /** Finished: score instead of odds, no rank, no predict CTA. */
  done?: boolean;
  open: boolean;
  toggle: () => void;
  filter: Filter;
  now: number | null;
  onSelect: (s: Sel) => void;
  fmt: Fmt;
}) {
  const { lang, tz, t } = fmt;
  const en = lang === "en";
  const names = sideNames(g, lang);
  const href = `/match/${g.slug}`;
  const sides = g.result?.sides ?? [];
  const bets = g.whales;
  const rows = bets.filter((b) => passes(filter, b));
  const hasMoney = (g.result?.result_whale_usdc ?? 0) > 0;
  const agree = g.result?.verdict === "with_market";
  const verdict = g.result?.verdict ? (agree ? t.verdictWith : t.verdictAgainst) : null;
  const league = en ? g.league.name : (g.league.name_fa ?? g.league.name);

  // One-line insight: where the whale money sits vs the market, plus a sharp contrarian if any.
  let insight = "";
  if (hasMoney) {
    const lead = [...sides].sort((a, b) => b.whale_usdc - a.whale_usdc)[0];
    insight = fill(t.insightLead, { share: pctOf(lang, pc(lead.whale_share) ?? 0), side: sideOutcome(lead.key, names, lang), p: probPct(lang, lead.p) });
    const sharp = bets.find((b) => b.stats && b.stats.tier !== "new" && (b.stats.score ?? 0) >= 80 && b.avg_price <= 0.3);
    if (sharp) insight += ` ${fill(t.insightSharp, { name: whaleName(sharp), score: num(lang, sharp.stats!.score!), bet: betLabel(sharp, names, enSideNames(g), lang) })}`;
  }

  return (
    <article style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 20, overflow: "hidden" }}>
      <div style={{ padding: "16px 16px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: done ? 18 : 26, fontWeight: 900, color: done ? "var(--muted)" : "var(--gold)", lineHeight: 1.1, width: 22, flexShrink: 0 }}>
            {done ? "✓" : num(lang, rank)}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {league}
              {g.starts_at ? ` · ${fill(t.kickoff, { time: timeOf(lang, g.starts_at, tz) })}` : ""}
            </div>
            <Link href={href} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 19, fontWeight: 800, color: "var(--text)", lineHeight: 1.45 }}>
              <Crest name={names.home} src={g.teams?.home?.logo} size={26} />
              <span>{names.home}</span>
              <span style={{ color: "var(--faint)", fontWeight: 400, fontSize: 15 }}>{t.vs}</span>
              <Crest name={names.away} src={g.teams?.away?.logo} size={26} />
              <span>{names.away}</span>
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end", flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{t.vol24}</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{money(lang, g.volume_24h)}</span>
          </div>
        </div>
        {done && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              background: "var(--bg2)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "12px 10px",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>{t.fullTime}</span>
            {g.live?.score && (
              <span dir="ltr" style={{ fontSize: 26, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
                {/* dir=ltr: away – home puts home on the right for RTL; LTR reads home – away. */}
                {en ? `${g.live.score.home} – ${g.live.score.away}` : <>{num(lang, g.live.score.away)} – {num(lang, g.live.score.home)}</>}
              </span>
            )}
          </div>
        )}
        {!done && sides.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${sides.length},minmax(0,1fr))`, gap: 6 }}>
            {sides.map((s) => {
              const col = SIDE_COLOR[s.key];
              return (
                <Link
                  key={s.key}
                  href={href}
                  className="pb-tile"
                  style={
                    {
                      "--tint": col.bg,
                      "--col": col.c,
                      background: "var(--bg2)",
                      border: "1px solid var(--line)",
                      borderRadius: 14,
                      padding: "14px 10px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      gap: 4,
                      color: "var(--text)",
                      minWidth: 0,
                    } as CSSProperties
                  }
                >
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12.5, color: "var(--muted)", minWidth: 0, maxWidth: "100%" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: col.c, flexShrink: 0 }} />
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sideOutcome(s.key, names, lang)}</span>
                  </span>
                  <span style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.15 }}>{probPct(lang, s.p)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="pb-row"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          border: "none",
          borderTop: "1px solid var(--line)",
          background: "var(--bg2)",
          color: "var(--text)",
          cursor: "pointer",
          textAlign: en ? "left" : "right",
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 800 }}>{t.whalesLabel}</span>
        <span style={{ fontSize: 12, color: "var(--muted)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {g.whale_bet_count ? fill(t.betsCount, { n: num(lang, g.whale_bet_count), money: money(lang, g.whale_total_usdc) }) : t.noWhalesShort}
        </span>
        {verdict && (
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 800,
              padding: "2px 9px",
              borderRadius: 999,
              color: agree ? "var(--text2)" : "var(--gold)",
              background: agree ? "var(--card)" : "var(--goldbg)",
              flexShrink: 0,
            }}
          >
            {verdict}
          </span>
        )}
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "1px solid var(--line)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            color: "var(--muted)",
            flexShrink: 0,
            transform: `rotate(${open ? 180 : 0}deg)`,
            transition: "transform .2s",
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <>
          <div style={{ background: "var(--bg2)", borderTop: "1px solid var(--line)" }}>
            <div style={{ padding: "13px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{t.preMatch}</span>
                {g.whale_bet_count > 0 && (
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {fill(t.betsCount, { n: num(lang, g.whale_bet_count), money: money(lang, g.whale_total_usdc) })}
                  </span>
                )}
              </div>
              {hasMoney && (
                <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{t.marketVsWhales}</span>
                    {verdict && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          padding: "3px 10px",
                          borderRadius: 999,
                          color: agree ? "var(--text2)" : "var(--gold)",
                          background: agree ? "var(--bg2)" : "var(--goldbg)",
                        }}
                      >
                        {verdict}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: "var(--muted)", flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 18, height: 5, borderRadius: 3, background: "var(--line2)" }} />
                      {t.marketOdds}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--home)" }} />
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--blue)", marginInlineStart: -3 }} />
                      {t.whaleShare}
                    </span>
                  </div>
                  {sides.map((s) => {
                    const col = SIDE_COLOR[s.key];
                    const mk = pc(s.p) ?? 0;
                    const wh = pc(s.whale_share) ?? 0;
                    const df = wh - mk;
                    return (
                      <div key={s.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 9, height: 9, borderRadius: "50%", background: col.c, flexShrink: 0 }} />
                          <span style={{ fontSize: 14, fontWeight: 800, flex: 1, minWidth: 0 }}>{sideOutcome(s.key, names, lang)}</span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: Math.abs(df) < 5 ? "var(--muted)" : df > 0 ? "var(--up)" : "var(--down)" }}>
                            {Math.abs(df) < 5 ? t.inLine : df > 0 ? fill(t.above, { n: num(lang, df) }) : fill(t.below, { n: num(lang, -df) })}
                          </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "54px 1fr 64px", gap: "4px 10px", alignItems: "center" }}>
                          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{t.marketLabel}</span>
                          <div style={{ height: 6, background: "var(--bg2)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${mk}%`, background: "var(--line2)", borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text2)", textAlign: en ? "right" : "left" }}>{pctOf(lang, mk)}</span>
                          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{t.whalesLabel}</span>
                          <div style={{ height: 12, background: "var(--bg2)", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${wh}%`, background: col.c, borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 15, fontWeight: 900, textAlign: en ? "right" : "left" }}>{pctOf(lang, wh)}</span>
                        </div>
                        <span style={{ fontSize: 11.5, color: "var(--faint)", paddingInlineStart: 64 }}>
                          {s.whale_usdc > 0 ? fill(t.sideMoney, { money: money(lang, s.whale_usdc) }) : t.noSideMoney}
                        </span>
                      </div>
                    );
                  })}
                  {insight && (
                    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, fontSize: 14, lineHeight: 1.9, color: "var(--text)", textWrap: "pretty" }}>{insight}</div>
                  )}
                </div>
              )}
            </div>

            {rows.map((b) => {
              const tier = tierOf(b.stats, lang);
              const tag = tagOf(b, lang);
              const side = b.side_key ?? null;
              return (
                <div
                  key={`${b.wallet}-${b.market.id}-${b.outcome_index}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect({ bet: b, game: g, names })}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect({ bet: b, game: g, names })}
                  className="pb-row"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", borderTop: "1px solid var(--line)" }}
                >
                  <ScoreRing score={b.stats?.score ?? null} color={tier.c} lang={lang} />
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      <Avatar name={whaleName(b)} src={b.profile_image} />
                      <span dir="ltr" style={{ fontSize: 14, fontWeight: 700, minWidth: 0, maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {whaleName(b)}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: tier.c }}>{tier.label}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: side ? SIDE_COLOR[side].c : "var(--faint)" }} />
                      <span style={{ color: "var(--text)", fontWeight: 600 }}>{betLabel(b, names, enSideNames(g), lang)}</span>
                      <span>{fill(t.atPrice, { pct: entryPct(b, lang) })}</span>
                      {now !== null && (
                        <>
                          <span style={{ color: "var(--faint)" }}>·</span>
                          <span>{agoOf(lang, b.last_at, now)}</span>
                        </>
                      )}
                    </div>
                    {tag && (
                      <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, color: tag.c, background: tag.bg }}>{tag.label}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end", flexShrink: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{money(lang, b.amount_usdc)}</span>
                    <span style={{ fontSize: 11, color: "var(--faint)" }}>{t.details}</span>
                  </div>
                </div>
              );
            })}

            {g.whale_bet_count === 0 && !g.error && (
              <div style={{ padding: "20px 16px 22px", display: "flex", flexDirection: "column", gap: 6, alignItems: "center", textAlign: "center" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    border: "1.5px dashed var(--line2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--faint)",
                    fontSize: 18,
                  }}
                >
                  ·
                </div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{t.noWhalesTitle}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.8 }}>{t.noWhalesBody}</div>
              </div>
            )}
            {g.error && (
              <div style={{ padding: "12px 16px 14px", fontSize: 12.5, color: "var(--muted)", borderTop: "1px solid var(--line)" }}>
                {t.error}
              </div>
            )}
            {bets.length > 0 && rows.length === 0 && (
              <div style={{ padding: "12px 16px 14px", fontSize: 12.5, color: "var(--muted)", borderTop: "1px solid var(--line)" }}>
                {t.emptyFilter}
              </div>
            )}
          </div>
          <div style={{ padding: "12px 16px 16px", borderTop: "1px solid var(--line)", display: "flex" }}>
            <Link href={href} className="pb-gold-btn" style={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: 15, padding: 13, borderRadius: 13 }}>
              {done ? t.viewGame : t.predictGame}
            </Link>
          </div>
        </>
      )}
    </article>
  );
}

function WhaleSheet({ sel, onClose, fmt }: { sel: Sel; onClose: () => void; fmt: Fmt }) {
  const { bet: b, game: g, names } = sel;
  const { lang, t } = fmt;
  const s = b.stats;
  const tier = tierOf(s, lang);
  const usd = (n: number | null | undefined) => money(lang, n);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const signed = (v: number | null | undefined, fmt: (n: number) => string) =>
    v === null || v === undefined
      ? { v: "—", c: "var(--muted)" }
      : { v: `${v >= 0 ? "▲ " : "▼ "}${fmt(Math.abs(v))}`, c: v >= 0 ? "var(--up)" : "var(--down)" };
  const pnl = signed(s?.pnl_usdc, usd);
  const rov = signed(s?.all_time_roi, (n) => `${num(lang, (n * 100).toFixed(1))}${lang === "en" ? "%" : "٪"}`);
  const m30 = signed(s?.month_pnl_usdc, usd);
  const stats = [
    { l: t.statPnl, ...pnl },
    { l: t.statRoi, ...rov },
    { l: t.stat30d, ...m30 },
    { l: t.statVolume, v: usd(s?.volume_usdc), c: "var(--text)" },
    { l: t.statMarkets, v: s?.markets_traded ? num(lang, s.markets_traded.toLocaleString("en-US")) : "—", c: "var(--text)" },
    {
      l: fill(t.statRank, { sport: (lang === "en" ? g.sport?.name : g.sport?.name_fa) ?? t.football }),
      v: s?.sport_rank && s.sport_pool ? fill(t.rankOf, { rank: num(lang, s.sport_rank), pool: num(lang, s.sport_pool) }) : "—",
      c: s?.sport_rank ? (s.sport_rank <= 3 ? "var(--up)" : "var(--text)") : "var(--muted)",
    },
  ];
  const name = whaleName(b);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "var(--scrim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={name}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "calc(100dvh - 32px)",
          overflowY: "auto",
          margin: "auto",
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 22,
          padding: "18px 18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          animation: "pbup .22s ease-out",
          boxShadow: "0 -20px 60px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <ScoreRing score={s?.score ?? null} color={tier.c} size={68} stroke={3} lang={lang} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar name={name} src={b.profile_image} size={30} />
              <span dir="ltr" style={{ fontSize: 17, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis" }}>
                {name}
              </span>
            </div>
            <span style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 700, color: tier.c, border: `1px solid ${tier.c}`, borderRadius: 999, padding: "1px 10px" }}>{tier.label}</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {s?.tier === "new" ? t.newNote : s?.score !== null && s ? fill(t.scoreNote, { score: num(lang, s.score!) }) : t.noRecord}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            style={{
              alignSelf: "flex-start",
              width: 32,
              height: 32,
              flexShrink: 0,
              borderRadius: "50%",
              border: "1px solid var(--line)",
              background: "var(--bg2)",
              color: "var(--muted)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
          {stats.map((x) => (
            <div key={x.l} style={{ background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{x.l}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: x.c }}>{x.v}</span>
            </div>
          ))}
        </div>
        {b.sharp && (
          <div style={{ border: "1px solid var(--up)", background: "var(--upbg)", borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "var(--up)", fontWeight: 800 }}>{t.sharpTitle}</span>
            <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.8 }}>
              {fill(t.sharpBody, { roi: pctOf(lang, Math.round(b.sharp.roi * 100)), n: num(lang, b.sharp.events) })}
              {b.sharp.wins !== null && b.sharp.losses !== null ? fill(t.sharpWL, { w: num(lang, b.sharp.wins), l: num(lang, b.sharp.losses) }) : ""}
              {b.sharp.pnl_usdc !== null ? fill(t.sharpProfit, { money: usd(b.sharp.pnl_usdc) }) : ""}
            </span>
          </div>
        )}
        <div style={{ border: "1px solid var(--goldline)", background: "var(--goldbg)", borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {fill(t.inThisGame, { home: names.home, away: names.away })}
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.7 }}>
            {fill(t.betLine, { money: usd(b.amount_usdc), bet: betLabel(b, names, enSideNames(g), lang), pct: entryPct(b, lang) })}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <a
            href={b.profile_url}
            target="_blank"
            rel="noopener nofollow"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 11,
              borderRadius: 13,
              border: "1px solid var(--line2)",
              background: "var(--bg2)",
              color: "var(--text)",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            <span>{t.viewProfile}</span>
            <span dir="ltr" style={{ color: "var(--muted)", fontSize: 12 }}>
              {b.name ? `@${b.name}` : `${b.wallet.slice(0, 6)}…`} ↗
            </span>
          </a>
          <Link href={`/match/${g.slug}`} className="pb-gold-btn" style={{ textAlign: "center", fontWeight: 800, fontSize: 15, padding: 13, borderRadius: 13 }}>
            {t.goToGame}
          </Link>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 12,
              borderRadius: 13,
              border: "1px dashed var(--line2)",
              color: "var(--faint)",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {t.copyTrader}{" "}
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", background: "var(--bluebg)", borderRadius: 6, padding: "1px 7px" }}>{t.soon}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Watch the ranked games that should be finishing, and report the ones that
 * have: from kickoff + 110 minutes (a football match runs ~1h55 with
 * half-time and stoppage time), each such game's live state is polled every
 * 30s through /api/match — the CDN-cached feed the match page uses — until it
 * says "ended". Nothing is polled before that point, so a page of games that
 * are hours away costs no requests at all.
 */
const EXPECTED_END_MS = 110 * 60_000;

function useEndedWatch(games: WhaleGame[]): Record<string, MatchLive> {
  const [ended, setEnded] = useState<Record<string, MatchLive>>({});
  const now = useNow(30_000);
  useEffect(() => {
    if (now === null) return;
    const due = games.filter(
      (g) => !ended[g.slug] && g.starts_at && now - new Date(g.starts_at).getTime() >= EXPECTED_END_MS,
    );
    if (!due.length) return;
    let alive = true;
    Promise.all(
      due.map((g) =>
        fetch(`/api/match/${encodeURIComponent(g.slug)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => (d?.live?.status === "ended" ? ([g.slug, d.live as MatchLive] as const) : null))
          .catch(() => null),
      ),
    ).then((res) => {
      const hits = res.filter((x): x is readonly [string, MatchLive] => x !== null);
      if (alive && hits.length) setEnded((cur) => ({ ...cur, ...Object.fromEntries(hits) }));
    });
    return () => {
      alive = false;
    };
    // Re-evaluated on every 30s tick; `ended` is read, not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, games]);
  return ended;
}
