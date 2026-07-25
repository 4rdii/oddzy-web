import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oddzy.xyz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The trading surface and our API proxies carry no search value.
      disallow: ["/app", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
