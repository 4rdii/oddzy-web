import Link from "next/link";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { NoMarket } from "@/components/site/NoMarket";
import {
  getEvents,
  getIndexableMarkets,
  getQuestionSeries,
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
  fixtureSides,
  fixtureTitle,
  fixtureUnit,
  leagueJsonLd,
  leagueSummary,
  sportJsonLd,
  upcomingOnly,
} from "@/components/site/SportsHub";
import { LeagueHubPb, SportHubPb, type SpotSide } from "@/components/pb/HubViews";
import { fixtureCard } from "@/components/pb/fixtures";
import { TopicPb } from "@/components/pb/TopicPb";
import { fa, faDay, faDigits, faTime, tehranDate } from "@/lib/pb";

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
  if (!topic) return <NoMarket lang={lang} />;

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
    const all = await Promise.all(
      hubs.leagues
        .filter((l) => l.sport?.slug === slug)
        .map(async (hub) => ({ hub, fixtures: (await hubFixtures(hub.slug)).fixtures })),
    );
    const leagues = all.map(({ hub, fixtures }) => ({ hub, next: fixtures.slice(0, 3) }));
    if (lang === "fa") {
      // PolyBaaz redesign (PB Sport Hub): today's biggest fixtures across every
      // league, then each league's next three.
      const live = leagues.filter((l) => l.next.length > 0);
      const today = tehranDate(new Date());
      const todays = all
        .flatMap(({ hub, fixtures }) =>
          fixtures
            .filter((e) => e.starts_at && tehranDate(e.starts_at) === today && new Date(e.starts_at).getTime() > Date.now() - 2 * 3600_000)
            .map((e) => ({ e, league: localized(lang, hub.name, hub.name_fa) })),
        )
        .sort((a, b) => (b.e.volume_24h ?? 0) - (a.e.volume_24h ?? 0))
        .slice(0, 12)
        .map(({ e, league }) => fixtureCard(e, league))
        .filter((c) => c !== null);
      const sportName = localized(lang, sportHub.name, sportHub.name_fa);
      return (
        <SiteChrome lang={lang}>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(sportJsonLd(lang, t, sportHub, live.map((l) => l.hub))) }}
          />
          <SportHubPb
            crumbs={[{ name: t.hub.home, href: "/" }, { name: sportName }]}
            h1={t.hub.sportH1.replace("{sport}", sportName)}
            summary={t.hub.sportSummary.replace("{count}", fa(sportHub.upcoming)).replace("{leagues}", fa(live.length))}
            today={todays}
            showWhales={slug === "football"}
            leagues={live.map(({ hub, next }) => ({
              key: hub.slug,
              name: localized(lang, hub.name, hub.name_fa),
              count: hub.upcoming,
              href: `/topic/${hub.slug}`,
              cards: next
                .map((e) => fixtureCard(e, e.starts_at ? `${faDay(e.starts_at)} · ${fa(e.market_count)} بازار` : `${fa(e.market_count)} بازار`))
                .filter((c) => c !== null),
            }))}
          />
        </SiteChrome>
      );
    }
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
    return <NoMarket lang={lang} topic={name} />;

  if (league && hub && lang === "fa") {
    // PolyBaaz redesign (PB League Hub). Season questions, markets and guides
    // still follow in `extras`, as on the EN page.
    const { league: leagueName, lines, next } = leagueSummary(lang, t, league, hub.fixtures);
    const faq = t.hub.faq.map((f) => ({ q: f.q.replace("{league}", leagueName), a: f.a.replace("{league}", leagueName) }));
    const sportName = league.sport ? localized(lang, league.sport.name, league.sport.name_fa) : null;
    const days = new Map<string, NonNullable<ReturnType<typeof fixtureCard>>[]>();
    for (const ev of hub.fixtures) {
      const card = fixtureCard(ev, `${fa(ev.market_count)} بازار`);
      if (!card) continue;
      const key = ev.starts_at ? faDay(ev.starts_at) : "—";
      if (!days.has(key)) days.set(key, []);
      days.get(key)!.push(card);
    }
    let spot = null;
    if (next) {
      const card = fixtureCard(next, "");
      const sides = fixtureSides(lang, t, next);
      const wins = next.main.filter((m) => m.kind === "moneyline");
      const draw = next.main.find((m) => m.kind === "draw");
      const title = next.title.toLowerCase();
      const at = (l: string | null | undefined) => {
        const i = title.indexOf(String(l ?? "").toLowerCase());
        return i < 0 ? 1e9 : i;
      };
      const ordered = [...wins].sort((x, y) => at(x.label) - at(y.label));
      const spotSides: SpotSide[] =
        ordered.length >= 2
          ? [
              { key: "home", label: `برد ${sides[0]?.name ?? ""}`, p: ordered[0].probability?.yes ?? null, slug: ordered[0].slug },
              ...(draw ? [{ key: "draw" as const, label: "مساوی", p: draw.probability?.yes ?? null, slug: draw.slug }] : []),
              { key: "away", label: `برد ${sides[sides.length - 1]?.name ?? ""}`, p: ordered[1].probability?.yes ?? null, slug: ordered[1].slug },
            ]
          : [];
      if (card && spotSides.length) {
        spot = {
          home: card.home,
          away: card.away,
          homeLogo: card.homeLogo ?? null,
          awayLogo: card.awayLogo ?? null,
          when: next.starts_at ? `${faDay(next.starts_at)} · ${faTime(next.starts_at)} به وقت تهران` : fixtureTitle(lang, t, next),
          marketCount: next.market_count,
          href: `/match/${next.id}`,
          sides: spotSides,
        };
      }
    }
    // «شانس قهرمانی»: the league's own winner question, when it has one.
    const winner = series.find((x) => x.kind === "outcomes" && /winner|champion/i.test(x.title ?? x.current.title));
    const winnerQ = winner ? await getQuestionSeries(winner.key).catch(() => null) : null;
    const opts = winnerQ?.outcomes?.options.filter((o) => o.status === "active") ?? [];
    const top = opts.slice(0, 5);
    const rest = opts.slice(5).reduce((a, o) => a + (o.probability?.yes ?? 0), 0);
    const title =
      winner && top.length
        ? {
            heading: localized(lang, winnerQ?.outcomes?.title ?? winner.title ?? "", winnerQ?.outcomes?.title_fa ?? winner.title_fa ?? null),
            href: `/question/${winner.key}`,
            rows: [
              ...top.map((o) => ({ team: o.label_fa ?? o.label, p: o.probability?.yes ?? null })),
              ...(rest > 0.005 ? [{ team: "سایر تیم‌ها", p: rest }] : []),
            ],
          }
        : null;
    const leagueLogo = hub.fixtures.find((e) => e.teams?.league_image)?.teams?.league_image ?? null;
    return (
      <SiteChrome lang={lang}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(leagueJsonLd(lang, t, league, hub.fixtures, faq)) }}
        />
        <LeagueHubPb
          crumbs={[
            { name: t.hub.home, href: "/" },
            ...(league.sport && sportName ? [{ name: sportName, href: `/topic/${league.sport.slug}` }] : []),
            { name: leagueName },
          ]}
          league={leagueName}
          leagueLogo={leagueLogo}
          h1={t.hub.leagueH1.replace("{league}", leagueName)}
          lines={lines.map(faDigits)}
          asOf={hub.asOf ? `${faDay(hub.asOf)} · ${faTime(hub.asOf)}` : null}
          next={spot}
          days={[...days.entries()].map(([label, cards]) => ({ label, cards }))}
          unit={fixtureUnit(t, league)}
          title={title}
          faq={faq}
        />
        <div className="pb">{extras}</div>
      </SiteChrome>
    );
  }

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

  if (lang === "fa") {
    // PolyBaaz redesign (PB Topic).
    const seriesName = (x: (typeof series)[number]) =>
      x.ladder
        ? ladderName(lang, t, x.ladder)
        : x.kind === "outcomes" && x.title
          ? localized(lang, x.title, x.title_fa ?? null)
          : localized(lang, x.current.title, x.current.title_fa);
    const features = series.slice(0, 4).map((x) => ({
      href: `/question/${x.key}`,
      kicker: x.ladder ? "نردبان قیمت" : x.kind === "outcomes" ? "پرسش چندگزینه‌ای" : "پرسش دنباله‌دار",
      title: seriesName(x),
      sub:
        x.kind === "outcomes" || x.ladder
          ? "همهٔ گزینه‌ها و احتمال هر کدام"
          : `${fa(x.member_count)} مهلت تا امروز${x.current.probability ? ` · احتمال فعلی ${fa(pct(x.current.probability.yes))}٪` : ""}`,
    }));
    return (
      <SiteChrome lang={lang}>
        <TopicPb
          h1={t.topic.h1.replace("{topic}", name)}
          lead={t.topic.lead}
          topicName={name}
          features={features}
          markets={rows}
          guides={<RelatedGuides categoryId={slug} lang={lang} heading="راهنماها" lead="" variant="pb" />}
        />
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
