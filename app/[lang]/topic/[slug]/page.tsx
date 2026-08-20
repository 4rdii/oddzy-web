import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import {
  getIndexableMarkets,
  getMarkets,
  getQuestionSeriesIndex,
  getTopics,
} from "@/lib/api";
import { findPath } from "@/lib/taxonomy";
import { publishedTopicSlugs } from "@/lib/topic-slugs";
import { BRANDS, isLocale, LOCALES } from "@/lib/i18n";
import { getDict } from "@/lib/dict";
import { compactUsd, localized, pct } from "@/lib/format";

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

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { lang, slug } = await props.params;
  if (!isLocale(lang)) return {};
  // Topics arrive as a tree, so a flat .find() would miss every nested node
  // (Sports > Football > Premier League). findPath walks it.
  const topic = findPath(await getTopics(), slug)?.at(-1);
  if (!topic) return {};
  const t = getDict(lang);
  const name = localized(lang, topic.name, topic.name_fa);
  return {
    title: t.topic.metaTitle.replace("{topic}", name),
    description: t.topic.metaDescription.replace("{topic}", name),
    alternates: {
      canonical: `/topic/${slug}`,
      languages: Object.fromEntries(
        LOCALES.map((l) => [BRANDS[l].htmlLang, `${BRANDS[l].siteUrl}/topic/${slug}`]),
      ),
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
  const [{ markets }, indexable, allSeries] = await Promise.all([
    getMarkets({ category: slug, limit: 40, revalidate: 3600 }),
    getIndexableMarkets(),
    getQuestionSeriesIndex(),
  ]);
  // Link only to pages that exist as indexed pages; the rest live in the app.
  const publishable = new Set(indexable.map((m) => m.slug));
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

  if (rows.length === 0 && series.length === 0) notFound();

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
                      {localized(lang, s.current.title, s.current.title_fa)}
                    </span>
                    <span className="mt-1 block font-mono text-[11px] text-[var(--faint)]">
                      <span className="ltr-num">
                        {t.topic.deadlines.replace("{count}", String(s.member_count))}
                      </span>
                    </span>
                  </span>
                  {s.current.probability && (
                    <span className="shrink-0 text-[20px] font-bold text-[var(--up)]">
                      <span className="ltr-num">{pct(s.current.probability.yes)}%</span>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="mx-auto flex max-w-3xl flex-col gap-2 px-5 pb-12">
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
                  {t.topic.vol} <span className="ltr-num">{compactUsd(m.volume.h24)}</span>
                </span>
              </span>
              <span className="shrink-0 text-[20px] font-bold text-[var(--up)]">
                <span className="ltr-num">{pct(m.probability.yes)}%</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </SiteChrome>
  );
}
