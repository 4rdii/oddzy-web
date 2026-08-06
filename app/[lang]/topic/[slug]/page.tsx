import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { getIndexableMarkets, getMarkets, getTopics } from "@/lib/api";
import { findPath } from "@/lib/taxonomy";
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
export const revalidate = 600;

/** Only hubs that actually have indexable markets under them get prerendered. */
export async function generateStaticParams() {
  const markets = await getIndexableMarkets();
  const slugs = [...new Set(markets.map((m) => m.category_id).filter(Boolean))] as string[];
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
  const [{ markets }, indexable] = await Promise.all([
    getMarkets({ category: slug, limit: 40 }),
    getIndexableMarkets(),
  ]);
  // Link only to pages that exist as indexed pages; the rest live in the app.
  const publishable = new Set(indexable.map((m) => m.slug));
  const rows = markets.filter((m) => publishable.has(m.slug));

  if (rows.length === 0) notFound();

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
