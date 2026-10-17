import { SiteChrome } from "@/components/site/Chrome";
import { WorldPb } from "@/components/pb/WorldPb";
import { getWorld } from "@/lib/api";
import { getDict } from "@/lib/dict";
import { brandFor, type Locale } from "@/lib/i18n";
import { nowMs } from "@/lib/pb";
import { emptyWorldView, toWorldView } from "@/lib/world";
import "./world.css";

/**
 * The world map screen, shared by PolyBaaz's /world and Oddzy's home page
 * (oddzy.xyz opens on the map; its /world 308s to /). Everything a crawler
 * needs — hero, totals, movers, news and the full ranked list — is in the
 * server render; the globe boots after hydration.
 *
 * `revalidate` is the caller's ISR window, passed through to the /world fetch
 * (a route regenerates at the LOWEST revalidate of any fetch it makes).
 */
export async function WorldScreen({ lang, revalidate }: { lang: Locale; revalidate: number }) {
  const t = getDict(lang).world;
  const world = await getWorld(revalidate, lang);
  const view = world ? toWorldView(world, lang) : emptyWorldView();
  const site = brandFor(lang).siteUrl;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t.listName,
    description: t.listDescription,
    numberOfItems: view.countries.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: view.countries.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      url: `${site}${c.href}`,
    })),
  };

  return (
    <SiteChrome lang={lang} active={lang === "fa" ? "/world" : "/"} pb>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <WorldPb initial={view} renderedAt={nowMs()} lang={lang} t={t} />
    </SiteChrome>
  );
}
