import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getAllPosts } from "@/lib/posts";
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

  // /app is deliberately absent — it's noindex, and listing it would invite
  // crawl budget to be spent on a surface with no search value.
  const staticRoutes = [
    { url: `${siteUrl}/`, priority: 1 },
    { url: `${siteUrl}/how-it-works`, priority: 0.8 },
    { url: `${siteUrl}/learn`, priority: 0.9 },
    { url: `${siteUrl}/faq`, priority: 0.7 },
  ].map((r) => ({ ...r, lastModified: new Date(), changeFrequency: "weekly" as const }));

  return [
    ...staticRoutes,
    ...posts.map((p) => ({
      url: `${siteUrl}/learn/${p.slug}`,
      lastModified: new Date(p.updatedAt ?? p.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
