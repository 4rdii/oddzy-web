import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/posts";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oddzy.xyz";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts();

  // /app is deliberately absent — it's noindex, and listing it would invite
  // crawl budget to be spent on a surface with no search value.
  const staticRoutes = [
    { url: `${SITE_URL}/`, priority: 1 },
    { url: `${SITE_URL}/how-it-works`, priority: 0.8 },
    { url: `${SITE_URL}/learn`, priority: 0.9 },
    { url: `${SITE_URL}/faq`, priority: 0.7 },
  ].map((r) => ({ ...r, lastModified: new Date(), changeFrequency: "weekly" as const }));

  return [
    ...staticRoutes,
    ...posts.map((p) => ({
      url: `${SITE_URL}/learn/${p.slug}`,
      lastModified: new Date(p.updatedAt ?? p.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
