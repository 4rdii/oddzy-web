import type { Metadata } from "next";
import type { TraderList } from "@/lib/api";
import type { Dict } from "@/lib/dict/en";

/**
 * Metadata and structured data for the trader library pages (/traders and
 * /traders/[list]), in one place so the overall page and the list pages cannot
 * drift apart.
 *
 * Every list gets its OWN description: with one shared description Google
 * treats fifteen pages as near-duplicates and picks one to show.
 */

type T = Dict["traders"];
const rec = (o: unknown) => o as Record<string, string>;

/** The page's H1 / share title for a list. */
export function tradersHeading(t: T, list: string): string {
  if (list === "all") return t.title;
  return rec(t.listTitles)[list] ?? t.titleList.replace("{cat}", rec(t.lists)[list] ?? list);
}

/** One or two plain sentences on what this list is; also the meta description. */
export function tradersDescription(t: T, list: string): string {
  if (list === "all") return t.metaDescription;
  const own = rec(t.listIntro)[list];
  const text = own ?? t.metaDescList.replace("{cat}", rec(t.lists)[list] ?? list);
  // Search results cut at about 160 characters; end on a whole sentence or word.
  if (text.length <= 170) return text;
  const cut = text.slice(0, 170);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("؛ "), cut.lastIndexOf("، "), cut.lastIndexOf(": "));
  return (stop > 90 ? cut.slice(0, stop + 1) : cut.slice(0, cut.lastIndexOf(" "))).trim();
}

export function tradersMetadata(t: T, list: string): Metadata {
  const named = rec(t.listTitles)[list];
  const title =
    list === "all" ? t.metaTitle : named ? t.metaTitleNamed.replace("{title}", named) : t.metaTitleList.replace("{cat}", rec(t.lists)[list] ?? list);
  const description = tradersDescription(t, list);
  const path = list === "all" ? "/traders" : `/traders/${list}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    // Without this the share card pointed at the home page.
    openGraph: { title, description, url: path, type: "website" },
    twitter: { title, description },
  };
}

/**
 * JSON-LD: where the page sits (breadcrumb) and what it lists (the ranked
 * traders, by name and position). Names only, no links: a trader has no page of
 * their own on this site.
 */
export function tradersJsonLd(t: T, list: string, data: TraderList | null, siteUrl: string, homeName: string) {
  const path = list === "all" ? "/traders" : `/traders/${list}`;
  const heading = tradersHeading(t, list);
  const crumbs = [
    { name: homeName, url: `${siteUrl}/` },
    { name: t.title, url: `${siteUrl}/traders` },
    ...(list === "all" ? [] : [{ name: heading, url: `${siteUrl}${path}` }]),
  ];
  const top = (data?.traders ?? []).slice(0, 20);
  return [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })),
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: heading,
      description: tradersDescription(t, list),
      url: `${siteUrl}${path}`,
      ...(data?.built_at ? { dateModified: data.built_at } : {}),
      mainEntity: {
        "@type": "ItemList",
        name: heading,
        numberOfItems: top.length,
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        itemListElement: top.map((tr, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: tr.name ?? t.anon.replace("{short}", `${tr.wallet.slice(0, 6)}…${tr.wallet.slice(-4)}`),
        })),
      },
    },
  ];
}
