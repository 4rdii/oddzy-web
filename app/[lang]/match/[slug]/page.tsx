import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { MatchBoard, type BoardGroup } from "@/components/site/MatchBoard";
import { getEventBoard, getSportsHubs, type EventBoard, type EventMarket } from "@/lib/api";
import { publishedTopicSlugs } from "@/lib/topic-slugs";
import { brandFor, isLocale, type Locale } from "@/lib/i18n";
import { getDict, type Dict } from "@/lib/dict";
import { compactUsd, kickoffLabel, localized, pct } from "@/lib/format";

/**
 * One sports match, as a public page: the result the market expects, then
 * every market on the fixture (goals, handicaps, corners, fight props…).
 *
 * A match is ONE page. None of its ~20–90 markets is indexed on its own —
 * that many near-identical pages per fixture is thin content, and to a
 * searcher the fixture is one thing. /market/<slug> for any of them redirects
 * here (see the market page). Only matches in /events/indexable are
 * prerendered and indexed; the rest render on demand as noindex.
 *
 * ISR window: a day, and it must equal MARKET_TTL (the board fetch) — a route
 * revalidates at the LOWEST revalidate of any fetch it makes. The live odds
 * are in the mini-app; this page exists to be found in search.
 */
export const revalidate = 86400;

/**
 * Prebuilt: LIVE indexable matches only. Most of the indexable set is played
 * matches (~480 of 500), and prebuilding those would be ~1000 pages of build
 * time and ISR writes for pages few people open. They still render on first
 * visit and cache for the day — the list existing at all is what keeps this
 * dynamic segment on the cached path (see the Next caching note).
 */
export async function generateStaticParams() {
  // Nothing prebuilt (match pages are noindex); the list existing at all keeps
  // this dynamic segment on the cached path — see the Next caching note.
  return [];
}

type Params = { params: Promise<{ lang: string; slug: string }> };

/** "Norway vs. Denmark" in the page's language. */
function matchTitle(lang: Locale, board: EventBoard): string {
  const { event, result } = board;
  if (lang !== "fa") return event.title;
  // FA event titles come back as «نروژ vs. دانمارک»; the side names are
  // translated individually, so build the title from them when we can.
  const sides = (result?.options ?? []).filter((o) => o.label !== "Draw");
  if (sides.length === 2 && sides.every((o) => o.label_fa)) return `${sides[0].label_fa} و ${sides[1].label_fa}`;
  if (event.title_fa) return event.title_fa.replace(/\s+vs\.?\s+/g, " و ");
  return event.title;
}

function sideName(lang: Locale, t: Dict, label: string, labelFa: string | null): string {
  if (label === "Draw") return t.match.draw;
  return lang === "fa" ? labelFa ?? label : label;
}

const FA_OUTCOME: Record<string, string> = { Yes: "بله", No: "خیر", Over: "بالاتر", Under: "پایین‌تر" };

function outcomeLabels(lang: Locale, t: Dict, m: EventMarket): { yes: string; no: string } {
  const ol = m.outcome_labels;
  if (ol?.yes && ol?.no) {
    if (lang !== "fa") return { yes: ol.yes, no: ol.no };
    return { yes: ol.yes_fa ?? FA_OUTCOME[ol.yes] ?? ol.yes, no: ol.no_fa ?? FA_OUTCOME[ol.no] ?? ol.no };
  }
  if (/\bO\/U\b/.test(m.title)) return { yes: t.match.over, no: t.match.under };
  return { yes: t.match.yes, no: t.match.no };
}

function boardGroups(lang: Locale, t: Dict, board: EventBoard): BoardGroup[] {
  const prefix = `${board.event.title}: `;
  // A fight's result is ONE market whose YES is the first-named fighter, so
  // its row reads "<fighter> 43% / <fighter> 57%", not "Yes / No".
  const h2h = board.result?.type === "head_to_head" ? board.result.options : null;
  return board.groups.map((g) => ({
    key: g.key,
    label: t.match.groups[g.key] ?? g.label,
    markets: g.markets.map((m) => {
      // "Norway vs. Denmark: O/U 2.5" → "O/U 2.5": the page already says which
      // match. The FA title's prefix is spelled several ways, so it is cut at
      // the first colon, and only when the English one had the prefix.
      const stripped = m.title.startsWith(prefix);
      const faCut = stripped && m.title_fa && m.title_fa.includes(": ") ? m.title_fa.slice(m.title_fa.indexOf(": ") + 2) : m.title_fa;
      const { yes, no } =
        h2h && m.slug === h2h[0].slug
          ? { yes: sideName(lang, t, h2h[0].label, h2h[0].label_fa), no: sideName(lang, t, h2h[1].label, h2h[1].label_fa) }
          : outcomeLabels(lang, t, m);
      return {
        slug: m.slug,
        title: stripped ? m.title.slice(prefix.length) : m.title,
        title_fa: faCut,
        p: m.probability ? m.probability.yes : null,
        yes,
        no,
        h24: m.volume.h24 ?? 0,
        status: m.status,
        outcome: m.outcome,
      };
    }),
  }));
}

const sumH24 = (ms: EventMarket[]) => ms.reduce((a, m) => a + (m.status === "active" ? m.volume.h24 ?? 0 : 0), 0);

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { lang, slug } = await props.params;
  if (!isLocale(lang)) return {};
  const board = await getEventBoard(slug);
  if (!board) return {};
  const t = getDict(lang);
  const title = matchTitle(lang, board);
  const opts = board.result?.options ?? [];
  const settled = board.event.status !== "active" || opts.some((o) => o.won !== null);
  const leader = [...opts].sort((a, b) => (b.p ?? 0) - (a.p ?? 0))[0];
  const description =
    settled || !leader || leader.p === null
      ? t.match.metaDescriptionResolved.replace("{title}", title).replace("{count}", String(board.market_count))
      : t.match.metaDescription
          .replace("{title}", title)
          .replace("{leader}", sideName(lang, t, leader.label, leader.label_fa))
          .replace("{chance}", String(pct(leader.p)))
          .replace("{count}", String(board.market_count));
  return {
    title: t.match.metaTitle.replace("{title}", title),
    description,
    alternates: {
      canonical: `/match/${board.event.id}`,
    },
    // Sports are indexed as league hubs, never match by match (product rule
    // 2026-09-24): the page serves people and redirects; follow keeps the
    // hub → match → hub links counting.
    robots: { index: false, follow: true },
  };
}

export default async function MatchPage(props: Params) {
  const { lang, slug } = await props.params;
  if (!isLocale(lang)) notFound();
  const board = await getEventBoard(slug);
  if (!board || board.market_count === 0) notFound();

  const t = getDict(lang);
  const brand = brandFor(lang);
  const { event, result } = board;
  const title = matchTitle(lang, board);
  const topics = await publishedTopicSlugs();
  // The breadcrumb names the league hub, not the generic "Matches" topic the
  // fixture is filed under.
  const leagueHub = (await getSportsHubs()).leagues.find((l) => event.topic && l.fixture_topics.includes(event.topic.id));
  const crumb = leagueHub
    ? { id: leagueHub.slug, name: leagueHub.name, name_fa: leagueHub.name_fa }
    : event.topic;
  const all = board.groups.flatMap((g) => g.markets);
  const resultGroup = board.groups.find((g) => g.key === "moneyline")?.markets ?? [];
  const options = result?.options ?? [];
  const settled = event.status !== "active" || options.some((o) => o.won !== null);
  const leaderP = Math.max(...options.map((o) => o.p ?? 0));
  const tradeSlug = options[0]?.slug ?? all[0]?.slug;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: title,
    ...(event.starts_at ? { startDate: event.starts_at } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    url: `${brand.siteUrl}/match/${event.id}`,
    inLanguage: brand.htmlLang,
  };

  const chip = "rounded-full border border-[var(--line)] px-2.5 py-1.5 font-mono text-[11px] tracking-[0.04em] text-[var(--text2)]";

  return (
    <SiteChrome lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="mx-auto max-w-3xl px-5 pt-10 pb-10">
        {crumb &&
          (topics.has(crumb.id) ? (
            <Link href={`/topic/${crumb.id}`} className="font-mono text-[11px] tracking-[0.06em] text-[var(--mute)]">
              {localized(lang, crumb.name, crumb.name_fa)}
            </Link>
          ) : (
            <p className="font-mono text-[11px] tracking-[0.06em] text-[var(--mute)]">
              {localized(lang, crumb.name, crumb.name_fa)}
            </p>
          ))}

        <h1 className="mt-3 text-[clamp(24px,4vw,34px)] leading-[1.2] font-bold tracking-[-0.02em]">{title}</h1>

        <div className="mt-3.5 flex flex-wrap gap-2">
          {event.starts_at && (
            <span className={chip}>
              {t.match.kickoff} · {kickoffLabel(event.starts_at, lang)}
              {t.match.tehran ? ` ${t.match.tehran}` : ""}
            </span>
          )}
          <span className={chip}>
            {t.match.markets.split("{count}")[0]}
            <span className="ltr-num">{board.market_count}</span>
            {t.match.markets.split("{count}")[1]}
          </span>
          {!settled && (
            <span className={chip}>
              {t.match.traded.split("{volume}")[0]}
              <span className="ltr-num">{compactUsd(sumH24(all))}</span>
              {t.match.traded.split("{volume}")[1]}
            </span>
          )}
        </div>

        {options.length > 0 && (
          <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
            <p className="font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]">
              {settled ? t.match.finalHeading : t.match.resultHeading}
            </p>
            <div className={`grid gap-2.5 ${options.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {options.map((o) => {
                const name = sideName(lang, t, o.label, o.label_fa);
                const label = result?.type === "head_to_head" || o.label === "Draw" ? name : t.match.win.replace("{name}", name);
                const lead = settled ? o.won === true : o.p !== null && o.p === leaderP;
                return (
                  <div
                    key={`${o.slug}-${o.label}`}
                    className={`flex min-w-0 flex-col gap-1.5 rounded-xl p-3 sm:p-3.5 ${
                      lead ? "bg-[var(--uptint)]" : "border border-[var(--line)]"
                    }`}
                  >
                    <span className="truncate text-[13px] text-[var(--text2)] sm:text-[14px]">{label}</span>
                    {settled ? (
                      <span className={`text-[20px] font-bold sm:text-[24px] ${lead ? "text-[var(--up)]" : "text-[var(--faint)]"}`}>
                        {o.won ? t.match.won : "—"}
                      </span>
                    ) : (
                      <span
                        className={`text-[28px] leading-none font-bold sm:text-[40px] ${lead ? "text-[var(--up)]" : ""}`}
                      >
                        <span className="ltr-num">{o.p === null ? "—" : `${pct(o.p)}%`}</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {!settled && (
              <>
                <div className="flex h-2 gap-[3px]" aria-hidden="true">
                  {options.map((o, i) => (
                    <span
                      key={`${o.slug}-${o.label}-bar`}
                      className="rounded"
                      style={{
                        flexGrow: Math.max(1, Math.round((o.p ?? 0) * 100)),
                        background: o.p === leaderP ? "var(--up)" : i === 1 && options.length === 3 ? "var(--handle)" : "var(--mute)",
                      }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-[13px] text-[var(--mute)]">
                    {t.match.backedBy.split("{volume}")[0]}
                    <span className="ltr-num">{compactUsd(sumH24(resultGroup))}</span>
                    {t.match.backedBy.split("{volume}")[1]}
                  </p>
                  {tradeSlug && (
                    <Link
                      href={`/app?market=${encodeURIComponent(tradeSlug)}`}
                      className="min-h-[44px] rounded-xl bg-[var(--accent)] px-5 py-3 text-[15px] font-semibold whitespace-nowrap text-[var(--on-accent)]"
                    >
                      {t.match.tradeMatch}
                    </Link>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        <section className="mt-9">
          <h2 className="text-[17px] font-bold tracking-[-0.01em]">{t.match.boardHeading}</h2>
          <p className="mt-1 text-[13px] text-[var(--mute)]">{t.match.boardLead}</p>
          <MatchBoard
            groups={boardGroups(lang, t, board)}
            lang={lang}
            labels={{
              showAll: t.match.showAll,
              showFewer: t.match.showFewer,
              rulesLoading: t.match.rulesLoading,
              rulesUnavailable: t.match.rulesUnavailable,
              resolved: t.match.resolved,
              tradeMarket: t.cta.tradeThisMarket,
              vol24: t.match.vol24,
              tablist: t.match.boardHeading,
            }}
          />
        </section>

        <p className="mt-7 rounded-xl border border-[var(--line)] px-4 py-3.5 text-[13px] leading-relaxed text-[var(--text2)]">
          {t.match.rulesNote}
        </p>

        {!settled && tradeSlug && (
          <section className="mt-7 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
            <p className="text-[15px] leading-relaxed">
              {t.match.ctaLead.split("{count}")[0]}
              <span className="ltr-num">{board.market_count}</span>
              {t.match.ctaLead.split("{count}")[1]}
            </p>
            <Link
              href={`/app?market=${encodeURIComponent(tradeSlug)}`}
              className="mt-4 inline-block rounded-xl bg-[var(--accent)] px-5 py-3 text-[15px] font-semibold text-[var(--on-accent)]"
            >
              {t.match.openApp}
            </Link>
          </section>
        )}

        <p className="mt-6 font-mono text-[11px] text-[var(--faint)]">
          {t.match.asOf}{" "}
          <span className="ltr-num">{new Date(board.as_of).toISOString().slice(0, 16).replace("T", " ")}</span> UTC ·{" "}
          {t.market.source}
        </p>
      </article>
    </SiteChrome>
  );
}
