import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getAllPosts } from "@/lib/posts";
import { getBaskets, getIndexableMarkets, getQuestionSeriesIndex } from "@/lib/api";
import { brandFor, localeForHost } from "@/lib/i18n";

/**
 * Per-host sitemap.
 *
 * Both brands are served by one deployment, so a build-time SITE_URL would make
 * polybaaz.com advertise oddzy.xyz URLs — a canonical-host mismatch that tells
 * Google the Farsi site is a duplicate of the English one. Reading the request
 * host opts this route into dynamic rendering, which is the right trade for a
 * file crawlers fetch a few times a day.
 *
 * `proxy.ts` deliberately excludes /sitemap.xml from the locale rewrite, so this
 * is reached unprefixed on both hostnames.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get("host");
  const locale = localeForHost(host);
  const siteUrl = brandFor(locale).siteUrl;

  const posts = await getAllPosts();
  // Only markets that passed the publishing gate (liquid, has rules, verified
  // Persian title). Driven by the same upstream call the pages use, so the
  // sitemap can never advertise a URL that renders as noindex.
  const markets = await getIndexableMarkets();
  // Rolling-deadline questions are advertised once, as the family page. Their
  // individual legs carry a canonical pointing there, so listing them here too
  // would ask Google to crawl five URLs in order to be told four are duplicates.
  const series = await getQuestionSeriesIndex();
  // Editorial pages, unlike everything else here — they exist because someone
  // published them, so they are listed whether or not their legs are indexable.
  const baskets = await getBaskets();
  const standalone = markets.filter((m) => !m.series_key);
  const topicSlugs = [
    ...new Set([
      ...markets.map((m) => m.category_id),
      ...series.map((s) => s.category_id),
    ].filter(Boolean)),
  ] as string[];

  // /app is deliberately absent — it's noindex, and listing it would invite
  // crawl budget to be spent on a surface with no search value.
  const staticRoutes = [
    { url: `${siteUrl}/`, priority: 1 },
    { url: `${siteUrl}/how-it-works`, priority: 0.8 },
    { url: `${siteUrl}/learn`, priority: 0.9 },
    { url: `${siteUrl}/faq`, priority: 0.7 },
    // Listed even though its contents expire every 15 minutes: the PAGE is
    // permanent and describes a standing product, the way a topic hub outlives
    // the markets under it. The windows themselves are never listed.
    { url: `${siteUrl}/updown`, priority: 0.8 },
    ...(baskets.length > 0 ? [{ url: `${siteUrl}/basket`, priority: 0.8 }] : []),
  ].map((r) => ({ ...r, lastModified: new Date(), changeFrequency: "weekly" as const }));

  return [
    ...staticRoutes,
    ...topicSlugs.map((slug) => ({
      url: `${siteUrl}/topic/${slug}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    // Daily: the price genuinely changes every day, and lastModified is the
    // signal that earns a re-crawl. Claiming it for a static page would be
    // noise; here it is true.
    //
    // ACTIVE ONLY. Settled markets were 70 of the 228 URLs here and every one
    // of them was orphaned: topic pages list what is trading, so nothing links
    // a fixture once it has been played. Advertising URLs no page links to is
    // how a sitemap teaches Google to discount the whole domain — and the
    // pages themselves are dated instances ("...on August 5", "...on
    // 2026-08-08") that nobody searches for afterwards. The evergreen version
    // of a recurring question is its /question/<key> family page, which is
    // listed below and does outlive each deadline.
    //
    // The pages stay live and indexable; they are simply no longer advertised.
    ...standalone
      .filter((m) => m.status === "active")
      .map((m) => ({
        url: `${siteUrl}/market/${m.slug}`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
    // Ranked above single markets: a family page carries the whole question's
    // history and outlives every individual deadline in it.
    ...series.map((s) => ({
      url: `${siteUrl}/question/${s.key}`,
      lastModified: new Date(),
      changeFrequency: (s.status === "active" ? "daily" : "yearly") as "daily" | "yearly",
      priority: s.status === "active" ? 0.8 : 0.5,
    })),
    // A basket page's prices move with its legs, so daily while any leg trades.
    ...baskets.map((b) => ({
      url: `${siteUrl}/basket/${b.slug}`,
      lastModified: new Date(),
      changeFrequency: (b.status === "active" ? "daily" : "yearly") as "daily" | "yearly",
      priority: b.status === "active" ? 0.8 : 0.4,
    })),
    ...posts.map((p) => ({
      url: `${siteUrl}/learn/${p.slug}`,
      lastModified: new Date(p.updatedAt ?? p.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
