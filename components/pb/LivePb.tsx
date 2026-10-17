"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { LiveBoard, LiveGame, LiveLeague, MatchLive, SideKey } from "@/lib/api";
import { Crest } from "@/components/pb/Crest";
import { MatchCard, type MatchCardData } from "@/components/pb/MatchCard";
import { periodLabel } from "@/components/pb/MatchView";
import { useNow, useTimeZone } from "@/components/pb/useNow";
import type { Dict } from "@/lib/dict/en";
import { num, pc, pctOf, timeOf, volOf, type PbLang } from "@/lib/pb";

/** The page's copy: getDict(lang).live, passed down by the server page (lib/dict is server-only; this is a type import). */
export type LiveStrings = Dict["live"];

/** "{n} games" -> "3 games": fills each {key} in a dict string. */
function fill(s: string, vars: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

/** Copy, language and display zone, threaded through the helpers below. */
type Ctx = { lang: PbLang; t: LiveStrings; tz: string };

/**
 * «زنده» — every game in play right now, the ones kicking off in the next
 * three hours, and today's finished ones; sports as chips, leagues (tennis:
 * tournaments) as sub-chips. Data: GET /live (oddzy-api, live-board.js).
 *
 * The server page renders a snapshot; this refreshes it from /api/live every
 * 15s while the tab is visible, and marks a result price that moved since the
 * previous refresh with a small ▲/▼.
 */

const POLL_MS = 15_000;

// League blocks flow side by side on wide screens (one scoreboard column per
// league), and stack on a phone; a block's own cards stack inside it.
const blocks: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "22px 16px", alignItems: "start" };

/** `${slug}|${side}` -> +1 / -1: the whole-percent price moved since the previous refresh. */
type Diff = Record<string, 1 | -1>;

function priceDiff(prev: LiveBoard, next: LiveBoard): Diff {
  // A stale baseline (an ISR snapshot minutes old) would flag every price at once.
  if (new Date(next.as_of).getTime() - new Date(prev.as_of).getTime() > 3 * POLL_MS) return {};
  const old = new Map<string, number | null>();
  for (const g of [...prev.live, ...prev.soon]) for (const s of g.sides) old.set(`${g.slug}|${s.key}`, pc(s.p));
  const out: Diff = {};
  for (const g of [...next.live, ...next.soon]) {
    for (const s of g.sides) {
      const k = `${g.slug}|${s.key}`;
      const a = old.get(k);
      const b = pc(s.p);
      if (a !== undefined && a !== null && b !== null && a !== b) out[k] = b > a ? 1 : -1;
    }
  }
  return out;
}

/** "۱۹:۴۵:۱۲" in Tehran; "7:45:12 PM" in the viewer's zone for en. */
function clockOf({ lang, tz }: Ctx, iso: string): string {
  if (lang === "fa") {
    return new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Tehran" });
  }
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: tz });
}

/** The clock line under a live game: «دقیقهٔ ۶۷», «بین دو نیمه», «ست سوم», «راند ۲»… / "67'", "Set 3", "Round 2". */
function liveLabel({ lang, t }: Ctx, l: MatchLive): string {
  if (l.status === "ended") return t.ended;
  const per = String(l.period ?? "").toUpperCase();
  const set = /^S(\d)$/.exec(per);
  if (set) return fill(t.set, { n: t.ordinals[Number(set[1]) - 1] ?? num(lang, set[1]) });
  const round = /^R(\d+)$/.exec(per);
  if (round) return fill(t.round, { n: num(lang, round[1]) });
  const quarter = /^Q(\d)$/.exec(per);
  if (quarter) return fill(t.quarter, { n: t.ordinals[Number(quarter[1]) - 1] ?? num(lang, quarter[1]) });
  if (per === "OT") return t.overtime;
  return periodLabel(l, lang);
}

/** Tennis-style "6-2, 5-7, 4-5" as [[6,2],[5,7],[4,5]] (home first); null for a plain a–b score. */
function setsOf(g: LiveGame): [number, number][] | null {
  const raw = g.live?.score_raw;
  if (!raw) return null;
  const tennisLike = g.sport.slug === "tennis" || raw.includes(",") || /^S\d$/i.test(String(g.live?.period ?? ""));
  if (!tennisLike) return null;
  const sets = raw
    .split(",")
    .map((x) => /(\d+)\s*-\s*(\d+)/.exec(x.replace(/\(.*?\)/g, "")))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => [Number(m[1]), Number(m[2])] as [number, number]);
  return sets.length ? sets : null;
}

type Side = { key: SideKey; name: string; logo: string | null; pct: number | null };

/** Home / draw / away with Persian (fa) or English (en) names and the crest matched by name (as fixtureCard does). */
function sidesOf({ lang, t: copy }: Ctx, g: LiveGame): Record<SideKey, Side | null> {
  const teams = [g.teams?.home, g.teams?.away];
  const out: Record<SideKey, Side | null> = { home: null, draw: null, away: null };
  for (const s of g.sides) {
    const i = s.key === "home" ? 0 : 1;
    const t = s.key === "draw" ? null : teams.find((x) => x && x.name.toLowerCase() === s.label.toLowerCase()) ?? teams[i] ?? null;
    out[s.key] = {
      key: s.key,
      name: s.key === "draw" ? copy.draw : lang === "fa" ? (s.label_fa ?? t?.name_fa ?? s.label) : s.label || t?.name || "",
      logo: t?.logo ?? null,
      pct: pc(s.p),
    };
  }
  return out;
}

function soonCard(ctx: Ctx, g: LiveGame, now: number | null): MatchCardData {
  const { lang, t } = ctx;
  const s = sidesOf(ctx, g);
  const kick = new Date(g.starts_at).getTime();
  let meta = "";
  if (now !== null) {
    const min = Math.ceil((kick - now) / 60_000);
    if (min <= 0) meta = t.awaitingStart;
    else if (min < 60) meta = fill(t.inMin, { m: num(lang, min) });
    else
      meta =
        min % 60
          ? fill(t.inHrMin, { h: num(lang, Math.floor(min / 60)), m: num(lang, min % 60) })
          : fill(t.inHr, { h: num(lang, min / 60) });
  }
  return {
    href: `/match/${g.slug}`,
    home: s.home?.name ?? "",
    away: s.away?.name ?? "",
    homeLogo: s.home?.logo,
    awayLogo: s.away?.logo,
    h: s.home?.pct ?? null,
    d: s.draw ? s.draw.pct : null,
    a: s.away?.pct ?? null,
    time: timeOf(lang, g.starts_at, ctx.tz),
    meta,
    vol: g.volume_24h,
  };
}

export type HubLink = { href: string; label: string };

export function LivePb({
  initial,
  lang = "fa",
  t,
  hubs,
}: {
  initial: LiveBoard;
  lang?: PbLang;
  t: LiveStrings;
  /** English only: sports hubs to reach from here (the FA page passes none). */
  hubs?: HubLink[];
}) {
  const [board, setBoard] = useState(initial);
  const [diff, setDiff] = useState<Diff>({});
  const [sport, setSport] = useState("all");
  const [league, setLeague] = useState("all");
  const [doneOpen, setDoneOpen] = useState(false);
  const last = useRef(initial);
  const now = useNow(30_000);
  const tz = useTimeZone(lang);
  const ctx: Ctx = { lang, t, tz };
  const n = (v: number) => num(lang, v);
  const gamesN = (v: number) => fill(v === 1 ? t.game : t.games, { n: n(v) });

  useEffect(() => {
    let alive = true;
    const load = () => {
      if (document.visibilityState === "hidden") return;
      fetch("/api/live")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: LiveBoard | null) => {
          if (!alive || !d || !Array.isArray(d.live)) return;
          setDiff(priceDiff(last.current, d));
          last.current = d;
          setBoard(d);
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // A sport or league that has dropped off the board reads as «همه».
  const sportOn = sport !== "all" && board.sports.some((s) => s.slug === sport) ? sport : "all";
  const leagues = sportOn === "all" ? [] : board.leagues.filter((l) => l.sport === sportOn);
  const leagueOn = leagues.some((l) => l.slug === league) ? league : "all";
  const keep = (g: LiveGame) => (sportOn === "all" || g.sport.slug === sportOn) && (leagueOn === "all" || g.group.slug === leagueOn);
  const live = board.live.filter(keep);
  const soon = board.soon.filter(keep);
  const finished = board.finished.filter(keep);
  const sportHit = board.sports.find((s) => s.slug === sportOn);
  const leagueHit = leagues.find((l) => l.slug === leagueOn);
  const sportName = (lang === "fa" ? sportHit?.name_fa : sportHit?.name) ?? null;
  const leagueName = (lang === "fa" ? leagueHit?.name_fa : leagueHit?.name) ?? null;
  const scope = leagueName ?? sportName;

  const byLeague = new Map(board.leagues.map((l, i) => [l.slug, { l, i }]));
  const groups = (list: LiveGame[]) => {
    const m = new Map<string, LiveGame[]>();
    for (const g of list) m.set(g.group.slug, [...(m.get(g.group.slug) ?? []), g]);
    return [...m.entries()]
      .map(([slug, games]) => ({ slug, games, l: byLeague.get(slug)?.l ?? null, i: byLeague.get(slug)?.i ?? 1e9 }))
      .sort((a, b) => a.i - b.i);
  };
  const showSport = sportOn === "all";

  const liveSection = live.length > 0 && (
    <Section
      key="live"
      title={
        <>
          <span className="pb-pulse" /> {t.nowTitle}
        </>
      }
      note={fill(t.inPlay, { n: n(live.length) })}
    >
      {groups(live).map((gr) => (
        <LeagueBlock key={gr.slug} ctx={ctx} slug={gr.slug} l={gr.l} games={gr.games} showSport={showSport} live>
          {gr.games.map((g) => (
            <LiveCard key={g.slug} ctx={ctx} g={g} diff={diff} />
          ))}
        </LeagueBlock>
      ))}
    </Section>
  );
  const soonSection = soon.length > 0 && (
    <Section key="soon" title={t.soonTitle} note={t.soonNote}>
      {groups(soon).map((gr) => (
        <LeagueBlock key={gr.slug} ctx={ctx} slug={gr.slug} l={gr.l} games={gr.games} showSport={showSport}>
          {gr.games.map((g) => (
            <MatchCard key={g.slug} m={soonCard(ctx, g, now)} lang={lang} />
          ))}
        </LeagueBlock>
      ))}
    </Section>
  );
  const hubHref = leagueOn !== "all" ? (leagues.find((l) => l.slug === leagueOn)?.hub ?? "football") : sportOn === "all" || sportOn === "other" ? "football" : sportOn;
  // The next real kickoff — not a delayed game whose start time already passed.
  // Measured against as_of rather than the clock, so server and client agree.
  const upcoming = soon.filter((g) => g.starts_at > board.as_of);
  const firstSoon = upcoming.length ? upcoming.reduce((a, b) => (a.starts_at < b.starts_at ? a : b)) : null;
  const delayed = soon.length - upcoming.length;
  const empty = live.length === 0 && (
    <div
      key="empty"
      style={{ border: "1px dashed var(--line2)", borderRadius: 16, padding: "18px 16px", display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}
    >
      <div style={{ fontSize: 15, fontWeight: 800 }}>{scope ? fill(t.noneLiveIn, { scope }) : t.noneLive}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>
        {firstSoon ? fill(t.nextAt, { time: timeOf(lang, firstSoon.starts_at, tz) }) : delayed ? t.waitingStart : t.noneSoon}
      </div>
      <Link href={`/topic/${hubHref}`} style={{ fontSize: 13, fontWeight: 700 }}>
        {fill(t.allGames, { scope: scope ?? t.football })}
      </Link>
    </div>
  );

  return (
    <div dir={lang === "fa" ? "rtl" : "ltr"} className="pb">
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "24px 16px 60px", display: "flex", flexDirection: "column", gap: 22 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--up)", fontWeight: 700 }}>
              <span className="pb-pulse" /> {t.badge}
            </span>
            <span style={{ color: "var(--faint)" }}>·</span>
            <span>{board.live.length ? fill(t.inPlay, { n: n(board.live.length) }) : t.noneInPlay}</span>
            <span style={{ color: "var(--faint)" }}>·</span>
            <span>{fill(t.updated, { time: clockOf(ctx, board.as_of) })}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(24px, 5vw, 30px)", fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.35 }}>{t.heading}</h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.9, color: "var(--text2)", maxWidth: 620, textWrap: "pretty" }}>
            {t.intro}
          </p>
          {hubs && hubs.length > 0 && (
            <nav aria-label={t.hubsLabel} className="pb-noscroll" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "2px -16px 0", padding: "0 16px" }}>
              {hubs.map((h) => (
                <Link
                  key={h.href}
                  href={h.href}
                  style={{
                    flexShrink: 0,
                    padding: "7px 13px",
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 600,
                    border: "1px solid var(--line)",
                    background: "var(--card)",
                    color: "var(--text2)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h.label}
                </Link>
              ))}
            </nav>
          )}
        </header>

        {board.sports.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="pb-noscroll" role="tablist" aria-label={t.sportTabs} style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -16px", padding: "0 16px" }}>
              {[{ slug: "all", name: t.all, name_fa: t.all, live: board.live.length, soon: board.soon.length }, ...board.sports].map((x) => {
                const on = x.slug === sportOn;
                return (
                  <button
                    key={x.slug}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => {
                      setSport(x.slug);
                      setLeague("all");
                    }}
                    style={{
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "9px 16px",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: "pointer",
                      border: `1px solid ${on ? "var(--gold)" : "var(--line)"}`,
                      background: on ? "var(--gold)" : "var(--card)",
                      color: on ? "var(--goldink)" : "var(--text2)",
                    }}
                  >
                    {lang === "fa" ? x.name_fa : x.name}
                    <Count ctx={ctx} live={x.live} soon={x.soon} solid={on} />
                  </button>
                );
              })}
            </div>
            {leagues.length > 1 && (
              <div className="pb-noscroll" role="tablist" aria-label={t.leagueTabs} style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -16px", padding: "0 16px" }}>
                {[
                  { slug: "all", name: t.all, name_fa: t.all, live: board.live.filter(keepSport(sportOn)).length, soon: board.soon.filter(keepSport(sportOn)).length },
                  ...leagues,
                ].map((x) => {
                  const on = x.slug === leagueOn;
                  return (
                    <button
                      key={x.slug}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setLeague(x.slug)}
                      style={{
                        flexShrink: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "7px 13px",
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        border: `1px solid ${on ? "var(--goldline)" : "var(--line)"}`,
                        background: on ? "var(--goldbg)" : "var(--card)",
                        color: on ? "var(--gold)" : "var(--text2)",
                      }}
                    >
                      {lang === "fa" ? x.name_fa : x.name}
                      <Count ctx={ctx} live={x.live} soon={x.soon} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Nothing in play: say so, and lead with what starts next. */}
        {live.length > 0 ? [liveSection, soonSection] : [empty, soonSection]}

        {finished.length > 0 && (
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <button
              type="button"
              onClick={() => setDoneOpen((v) => !v)}
              aria-expanded={doneOpen}
              className="pb-row"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "13px 16px",
                border: "1px solid var(--line)",
                borderRadius: 16,
                background: "var(--card)",
                color: "var(--text)",
                cursor: "pointer",
                textAlign: lang === "fa" ? "right" : "left",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t.finishedTitle}</h2>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{fill(t.finishedNote, { games: gamesN(finished.length) })}</span>
              <span style={{ marginInlineStart: "auto", fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>{doneOpen ? t.hide : t.show}</span>
            </button>
            {/* Rendered while collapsed (hidden), so the match links are still in the HTML. */}
            <div hidden={!doneOpen} style={{ ...blocks, display: doneOpen ? "grid" : "none" }}>
              {groups(finished).map((gr) => (
                <LeagueBlock key={gr.slug} ctx={ctx} slug={gr.slug} l={gr.l} games={gr.games} showSport={showSport}>
                  {gr.games.map((g) => (
                    <LiveCard key={g.slug} ctx={ctx} g={g} diff={{}} done />
                  ))}
                </LeagueBlock>
              ))}
            </div>
          </section>
        )}

        <div style={{ fontSize: 11.5, color: "var(--faint)", lineHeight: 1.9 }}>
          {t.source}
        </div>
      </main>
    </div>
  );
}

const keepSport = (sport: string) => (g: LiveGame) => sport === "all" || g.sport.slug === sport;

/** A chip's count: live games in green, or (none live) upcoming ones muted. */
function Count({ ctx: { lang, t }, live, soon, solid }: { ctx: Ctx; live: number; soon: number; solid?: boolean }) {
  const n = live || soon;
  if (!n) return null;
  const isLive = live > 0;
  return (
    <span
      title={isLive ? fill(t.countLive, { n: num(lang, live) }) : fill(t.countSoon, { n: num(lang, soon) })}
      style={{
        fontSize: 11.5,
        fontWeight: 800,
        lineHeight: 1,
        padding: "3px 7px",
        borderRadius: 999,
        color: solid ? "var(--goldink)" : isLive ? "var(--up)" : "var(--muted)",
        background: solid ? "color-mix(in srgb, var(--goldink) 14%, transparent)" : isLive ? "var(--upbg)" : "var(--bg2)",
      }}
    >
      {num(lang, n)}
    </span>
  );
}

function Section({ title, note, children }: { title: ReactNode; note?: string; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 9 }}>{title}</h2>
        {note && <span style={{ fontSize: 12, color: "var(--muted)" }}>{note}</span>}
      </div>
      <div style={blocks}>{children}</div>
    </section>
  );
}

/** One league (tennis: tournament) inside a section: crest + name header, then its cards. */
function LeagueBlock({
  ctx: { lang, t },
  slug,
  l,
  games,
  showSport,
  live,
  children,
}: {
  ctx: Ctx;
  slug: string;
  l: LiveLeague | null;
  games: LiveGame[];
  showSport: boolean;
  /** The in-play section: the count reads "3 games live", in green. */
  live?: boolean;
  children: ReactNode;
}) {
  const g0 = games[0];
  const name = lang === "fa" ? (l?.name_fa ?? g0.group.name_fa ?? g0.group.name) : (l?.name ?? g0.group.name);
  const one = games.length === 1;
  const hub = l?.hub ?? g0.league.slug;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-league={slug}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, borderBottom: "1px solid var(--line)", paddingBottom: 9 }}>
        <Crest name={name} src={l?.image ?? g0.league.image} size={22} />
        <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <Link href={`/topic/${hub}`} style={{ color: "var(--text)" }}>
            {name}
          </Link>
        </h3>
        {showSport && <span style={{ fontSize: 12, color: "var(--faint)", flexShrink: 0 }}>{lang === "fa" ? g0.sport.name_fa : g0.sport.name}</span>}
        <span style={{ marginInlineStart: "auto", fontSize: 12, color: live ? "var(--up)" : "var(--muted)", flexShrink: 0 }}>
          {fill(live ? (one ? t.gameLive : t.gamesLive) : one ? t.game : t.games, { n: num(lang, games.length) })}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}

/**
 * An in-play (or finished) game: the PbMatchCard frame with a live pill, the
 * score beside each side (tennis: one cell per set), and the result odds.
 */
function LiveCard({ ctx, g, diff, done }: { ctx: Ctx; g: LiveGame; diff: Diff; done?: boolean }) {
  const { lang, t } = ctx;
  const s = sidesOf(ctx, g);
  const l = g.live;
  const sets = setsOf(g);
  const score = !sets && l?.score ? l.score : null;
  // Fights and the like: the raw score is not "a-b", so it goes in the header.
  const rawNote = !sets && !score && l?.score_raw ? l.score_raw : null;
  const vals = [s.home?.pct, s.draw?.pct, s.away?.pct].filter((v): v is number => v !== null && v !== undefined);
  const mx = vals.length ? Math.max(...vals) : -1;
  const c = (v: number | null | undefined) => (v !== null && v !== undefined && v === mx ? "var(--gold)" : "var(--text2)");
  const seg = (v: number | null | undefined) => (v !== null && v !== undefined && v === mx ? "var(--gold)" : "var(--line2)");
  const pct = (v: number | null | undefined) => pctOf(lang, v);
  const arrow = (k: SideKey) => {
    const d = diff[`${g.slug}|${k}`];
    if (!d) return null;
    return (
      <span aria-label={d > 0 ? t.priceUp : t.priceDown} style={{ fontSize: 9, color: d > 0 ? "var(--up)" : "var(--down)", marginInlineEnd: 3 }}>
        {d > 0 ? "▲" : "▼"}
      </span>
    );
  };

  // Who won, for a finished game: more goals / more sets, else the settled price.
  let winner: SideKey | null = null;
  if (done) {
    if (score) winner = score.home > score.away ? "home" : score.away > score.home ? "away" : "draw";
    else if (sets) {
      const won = sets.reduce((a, [h, w]) => [a[0] + (h > w ? 1 : 0), a[1] + (w > h ? 1 : 0)], [0, 0]);
      winner = won[0] > won[1] ? "home" : won[1] > won[0] ? "away" : null;
    } else winner = (["home", "draw", "away"] as SideKey[]).find((k) => (s[k]?.pct ?? 0) >= 99) ?? null;
  }

  const cell = (strong: boolean, small: boolean): CSSProperties => ({
    minWidth: small ? 22 : 28,
    height: small ? 22 : 28,
    padding: "0 4px",
    borderRadius: 7,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: small ? 12.5 : 16,
    fontWeight: strong ? 900 : 700,
    fontVariantNumeric: "tabular-nums",
    background: strong ? "var(--bg2)" : "transparent",
    border: `1px solid ${strong ? "var(--line2)" : "transparent"}`,
    color: strong ? "var(--text)" : "var(--muted)",
  });

  const row = (k: "home" | "away") => {
    const x = s[k];
    if (!x) return null;
    const i = k === "home" ? 0 : 1;
    const lost = done && winner !== null && winner !== k;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 15, fontWeight: 600, lineHeight: 1.5, minWidth: 0, flex: 1, color: lost ? "var(--muted)" : "var(--text)" }}>
          <Crest name={x.name} src={x.logo} size={22} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}</span>
        </span>
        {sets && (
          <span style={{ display: "inline-flex", gap: 2, flexShrink: 0 }}>
            {sets.map((st, j) => {
              const current = !done && j === sets.length - 1;
              const tookSet = st[i] > st[1 - i];
              return (
                <span key={j} style={cell(current || tookSet, true)}>
                  {num(lang, st[i])}
                </span>
              );
            })}
          </span>
        )}
        {score && (
          <span style={cell(true, false)}>{num(lang, k === "home" ? score.home : score.away)}</span>
        )}
        {!done && (
          <span style={{ fontSize: 16, fontWeight: 800, color: c(x.pct), minWidth: 44, textAlign: lang === "fa" ? "left" : "right", flexShrink: 0 }}>
            {arrow(k)}
            {pct(x.pct)}
          </span>
        )}
      </div>
    );
  };

  return (
    <Link
      href={`/match/${g.slug}`}
      className="pb-card-link"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "14px 16px 13px",
        color: "var(--text)",
        height: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)" }}>
        {done ? (
          <span style={{ background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 7, padding: "2px 8px", color: "var(--text2)", fontWeight: 700, flexShrink: 0 }}>
            {t.final}
          </span>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--upbg)",
              borderRadius: 7,
              padding: "2px 8px",
              color: "var(--up)",
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            <span className="pb-pulse" />
            {l ? liveLabel(ctx, l) : t.playing}
          </span>
        )}
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {rawNote ? <span dir="ltr">{num(lang, rawNote)}</span> : fill(t.started, { time: timeOf(lang, g.starts_at, ctx.tz) })}
        </span>
        <span style={{ marginInlineStart: "auto", color: "var(--faint)" }}>{lang === "fa" ? "←" : "→"}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {row("home")}
        {row("away")}
      </div>
      {!done && (
        <div style={{ display: "flex", gap: 3, height: 5, marginTop: "auto" }}>
          {[s.home?.pct, s.draw?.pct, s.away?.pct].map((v, i) =>
            v === null || v === undefined ? null : <span key={i} style={{ flex: Math.max(v, 1), background: seg(v), borderRadius: 3 }} />,
          )}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginTop: done ? "auto" : undefined }}>
        <span>
          {!done && s.draw && (
            <>
              {t.draw} {arrow("draw")}
              <b style={{ color: c(s.draw.pct), fontWeight: 700 }}>{pct(s.draw.pct)}</b>
            </>
          )}
          {done && winner === "draw" && t.draw}
        </span>
        <span>{volOf(lang, g.volume_24h)}</span>
      </div>
    </Link>
  );
}
