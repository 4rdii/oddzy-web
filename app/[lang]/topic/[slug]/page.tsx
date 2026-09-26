import Link from "next/link";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import {
  getEvents,
  getIndexableMarkets,
  getMarkets,
  getQuestionSeriesIndex,
  getSportsHubs,
  getTopics,
} from "@/lib/api";
import { findPath } from "@/lib/taxonomy";
import { publishedTopicSlugs } from "@/lib/topic-slugs";
import { isLocale, LOCALES } from "@/lib/i18n";
import { getDict } from "@/lib/dict";
import { compactUsd, localized, pct } from "@/lib/format";
import { RelatedGuides } from "@/components/site/RelatedGuides";
import { ladderName } from "@/components/site/LadderView";
import {
  LeagueHubView,
  SportHubView,
  fixtureUnit,
  leagueSummary,
  upcomingOnly,
} from "@/components/site/SportsHub";

/**
 * A topic hub — the permanent anchor for a subject.
 *
 * Individual markets expire; «ایران» does not. Because a hub never dies, links
 * and rankings accumulate on it while the markets underneath rotate, and any
 * inbound link lands somewhere alive even after the specific market it
 * described has resolved. Hubs compete for head terms; market pages take the
 * long tail.
 */
/**
 * ISR window. Deliberately an hour, and deliberately matched by the fetch
 * inside the page: a route revalidates at the LOWEST revalidate of any fetch it
 * makes, so raising this number alone would have changed nothing.
 *
 * Every regeneration is a billed ISR write, and this route is ~54 of them
 * across the two locales — enough that ordinary crawler traffic, not users,
 * exhausted a 200k/month quota in August 2026. Nothing here needs 10-minute
 * freshness: the upstream snapshot only moves every ~30 min, and the live
 * numbers are in the mini-app, which is not cached at all.
 */
export const revalidate = 3600;

/** Only hubs that actually have indexable content under them get prerendered. */
export async function generateStaticParams() {
  const slugs = [...(await publishedTopicSlugs())];
  return LOCALES.flatMap((lang) => slugs.map((slug) => ({ lang, slug })));
}

type Params = { params: Promise<{ lang: string; slug: string }> };

/**
 * A league hub's fixtures: upcoming matches only, result odds only, at the
 * page's own ISR window (a shorter fetch window would cap the route).
 */
async function hubFixtures(slug: string) {
  const res = await getEvents({
    category: slug,
    limit: 150,
    mainOnly: true,
    matchesOnly: true,
    includeClosing: true,
    revalidate: 3600,
  });
  return { fixtures: upcomingOnly(res.events), asOf: res.as_of ?? null };
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { lang, slug } = await props.params;
  if (!isLocale(lang)) return {};
  // Topics arrive as a tree, so a flat .find() would miss every nested node
  // (Sports > Football > Premier League). findPath walks it.
  const topic = findPath(await getTopics(), slug)?.at(-1);
  if (!topic) return {};
  const t = getDict(lang);
  const name = localized(lang, topic.name, topic.name_fa);
  const alternates = {
    canonical: `/topic/${slug}`,
  };
  const hubs = await getSportsHubs();
  const league = hubs.leagues.find((l) => l.slug === slug);
  if (league) {
    const { fixtures } = await hubFixtures(slug);
    const { league: leagueName, next } = leagueSummary(
      lang,
      t,
      league,
      fixtures,
    );
    const nextText = next?.starts_at
      ? t.hub.leagueNext
          .replace(
            "{match}",
            lang === "fa"
              ? (next.title_fa ?? next.title).replace(/\s+vs\.?\s+/g, " و ")
              : next.title,
          )
          .replace(
            "{date}",
            new Date(next.starts_at).toLocaleDateString(
              lang === "fa" ? "fa-IR-u-ca-gregory" : "en-US",
              { day: "numeric", month: "long", timeZone: "UTC" },
            ),
          )
      : "";
    return {
      title: t.hub.leagueMetaTitle
        .replace("{league}", leagueName)
        .replace("{heading}", league.sport?.slug === "mma" ? t.hub.fixturesHeadingFights : t.hub.fixturesHeading),
      description: t.hub.leagueMetaDescription
        .replace("{count}", String(fixtures.length))
        .replace("{league}", leagueName)
        .replace("{unit}", fixtureUnit(t, league))
        .replace("{next}", nextText),
      alternates,
    };
  }
  const sport = hubs.sports.find((x) => x.slug === slug);
  if (sport) {
    const sportName = localized(lang, sport.name, sport.name_fa);
    return {
      title: t.hub.sportMetaTitle.replace("{sport}", sportName),
      description: t.hub.sportMetaDescription
        .replace("{count}", String(sport.upcoming))
        .replace("{sport}", sportName)
        .replace("{leagues}", String(sport.leagues.length)),
      alternates,
    };
  }
  return {
    title: t.topic.metaTitle.replace("{topic}", name),
    description: t.topic.metaDescription.replace("{topic}", name),
    alternates: {
      canonical: `/topic/${slug}`,
    },
  };
}

export default async function TopicPage(props: Params) {
  const { lang, slug } = await props.params;
  if (!isLocale(lang)) notFound();

  const topic = findPath(await getTopics(), slug)?.at(-1);
  if (!topic) notFound();

  const t = getDict(lang);
  const name = localized(lang, topic.name, topic.name_fa);
  const hubs = await getSportsHubs();
  // A generic fixture topic ("Matches" under La Liga) has no page of its own:
  // its league hub is the one indexed page for those fixtures.
  const parentHub = hubs.leagues.find(
    (l) => l.slug !== slug && l.fixture_topics.includes(slug),
  );
  if (parentHub) permanentRedirect(`/topic/${parentHub.slug}`);
  const league = hubs.leagues.find((l) => l.slug === slug);
  const sportHub = hubs.sports.find((x) => x.slug === slug);

  const [{ markets }, indexable, allSeries] = await Promise.all([
    getMarkets({ category: slug, limit: 40, revalidate: 3600 }),
    getIndexableMarkets(),
    getQuestionSeriesIndex(),
  ]);
  // Link only to pages that exist as indexed pages; the rest live in the app.
  // A market that belongs to a question page (a rolling deadline or a price
  // ladder) is listed through that page above, and its own URL redirects or
  // canonicalises there — listing it again is a duplicate link.
  const publishable = new Set(
    indexable.filter((m) => !m.series_key).map((m) => m.slug),
  );
  const rows = markets.filter((m) => publishable.has(m.slug));

  /**
   * Rolling questions belonging to this topic.
   *
   * These family pages are the canonical destination for every dated leg of a
   * recurring question, and until now nothing on the site linked to them —
   * each leg canonicalised to a hub that was reachable only from the sitemap.
   * A topic hub is where they belong: the question outlives its deadlines in
   * exactly the way the topic outlives its markets.
   */
  const series = allSeries.filter((s) => s.category_id === slug);

  if (sportHub) {
    const leagues = await Promise.all(
      hubs.leagues
        .filter((l) => l.sport?.slug === slug)
        .map(async (hub) => ({
          hub,
          next: (await hubFixtures(hub.slug)).fixtures.slice(0, 3),
        })),
    );
    return (
      <SiteChrome lang={lang}>
        <SportHubView
          lang={lang}
          t={t}
          sport={sportHub}
          leagues={leagues.filter((l) => l.next.length > 0)}
        />
      </SiteChrome>
    );
  }

  // Season questions, standalone markets and guides: the tail of every topic
  // hub, league hubs included.
  const extras = (
    <>
      {series.length > 0 && (
        <section className="mx-auto max-w-3xl px-5 pb-2">
          <h2 className="font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]">
            {t.topic.ongoing}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {series.map((s) => (
              <li key={s.key}>
                <Link
                  href={`/question/${s.key}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-[var(--line)] p-4 text-[var(--ink)]"
                >
                  <span className="flex-1">
                    <span className="block text-[15px] leading-snug font-semibold">
                      {s.ladder
                        ? ladderName(lang, t, s.ladder)
                        : s.kind === "outcomes" && s.title
                          ? localized(lang, s.title, s.title_fa ?? null)
                          : localized(
                              lang,
                              s.current.title,
                              s.current.title_fa,
                            )}
                    </span>
                    {/* A ladder's member count is every level of every period —
                        not a number a reader can use, so it is left off. */}
                    {!s.ladder && s.kind !== "outcomes" && (
                      <span className="mt-1 block font-mono text-[11px] text-[var(--faint)]">
                        <span className="ltr-num">
                          {t.topic.deadlines.replace(
                            "{count}",
                            String(s.member_count),
                          )}
                        </span>
                      </span>
                    )}
                  </span>
                  {!s.ladder &&
                    s.kind !== "outcomes" &&
                    s.current.probability && (
                      <span className="shrink-0 text-[20px] font-bold text-[var(--up)]">
                        <span className="ltr-num">
                          {pct(s.current.probability.yes)}%
                        </span>
                      </span>
                    )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="mx-auto flex max-w-3xl flex-col gap-2 px-5 pb-4">
        {rows.map((m) => (
          <li key={m.id}>
            <Link
              href={`/market/${m.slug}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--card)] p-4 text-[var(--ink)]"
            >
              <span className="flex-1">
                <span className="block text-[15px] leading-snug font-semibold">
                  {localized(lang, m.title, m.title_fa)}
                </span>
                <span className="mt-1 block font-mono text-[11px] text-[var(--faint)]">
                  {t.topic.vol}{" "}
                  <span className="ltr-num">{compactUsd(m.volume.h24)}</span>
                </span>
              </span>
              <span className="shrink-0 text-[20px] font-bold text-[var(--up)]">
                <span className="ltr-num">{pct(m.probability.yes)}%</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mx-auto max-w-3xl px-5 pb-12">
        <RelatedGuides
          categoryId={slug}
          lang={lang}
          heading={t.guides.heading}
          lead={t.guides.topicLead}
        />
      </div>
    </>
  );

  const hub = league ? await hubFixtures(slug) : null;
  if (!hub?.fixtures.length && rows.length === 0 && series.length === 0)
    notFound();

  if (league && hub) {
    // The league's fixtures lead; its season questions (winner, top scorer…)
    // and any standalone markets follow, as on every topic hub.
    return (
      <SiteChrome lang={lang}>
        <LeagueHubView
          lang={lang}
          t={t}
          hub={league}
          fixtures={hub.fixtures}
          asOf={hub.asOf}
        />
        {extras}
      </SiteChrome>
    );
  }

  return (
    <SiteChrome lang={lang}>
      <div className="mx-auto max-w-3xl px-5 pt-12 pb-4">
        <h1 className="text-[clamp(26px,4.5vw,38px)] font-bold tracking-[-0.03em]">
          {t.topic.h1.replace("{topic}", name)}
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--text2)]">
          {t.topic.lead}
        </p>
      </div>

      {extras}
    </SiteChrome>
  );
}
