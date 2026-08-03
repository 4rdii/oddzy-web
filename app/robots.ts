import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { brandFor, localeForHost } from "@/lib/i18n";

/** Per-host robots, for the same canonical reason as sitemap.ts. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host");
  const siteUrl = brandFor(localeForHost(host)).siteUrl;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The trading surface and our API proxies carry no search value.
      disallow: ["/app", "/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
