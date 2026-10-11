import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { WorldPb } from "@/components/pb/WorldPb";
import { getWorld } from "@/lib/api";
import { brandFor, isLocale } from "@/lib/i18n";
import { nowMs } from "@/lib/pb";
import { emptyWorldView, toWorldView } from "@/lib/world";
import "./world.css";

/**
 * «نقشهٔ جهان» — PolyBaaz only (design: PB World Map.html).
 *
 * ISR window: 5 minutes, matched by the /world fetch (a route regenerates at
 * the LOWEST revalidate of any fetch it makes). The page does not need to be
 * fresher than that: once hydrated it refreshes itself from /api/world every
 * 60s, which is CDN-cached and is not an ISR write.
 */
export const revalidate = 300;

export async function generateStaticParams() {
  return [{ lang: "fa" }];
}

type Params = { params: Promise<{ lang: string }> };

const TITLE = "نقشهٔ جهان · بازارهای سیاست و جنگ | پلی‌باز";
const DESCRIPTION = "داغ‌ترین بازارهای پیش‌بینی سیاست، جنگ و ژئوپلیتیک روی نقشهٔ جهان؛ احتمال زنده و حجم معاملهٔ ۲۴ ساعت هر کشور.";

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { lang } = await props.params;
  if (lang !== "fa") return {};
  return {
    // The design's own <title>, which already carries the brand: skip the layout's "· پلی‌باز" template.
    title: { absolute: TITLE },
    description: DESCRIPTION,
    alternates: { canonical: "/world" },
    openGraph: { title: TITLE, description: DESCRIPTION, url: "/world" },
  };
}

export default async function WorldPage(props: Params) {
  const { lang } = await props.params;
  // Persian-only page for now: the design, copy and audience are PolyBaaz's.
  if (!isLocale(lang) || lang !== "fa") notFound();
  const world = await getWorld(revalidate);
  const view = world ? toWorldView(world) : emptyWorldView();
  const site = brandFor(lang).siteUrl;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "داغ‌ترین کشورها همین حالا",
    description: "کشورها بر اساس حجم معاملهٔ ۲۴ ساعت گذشته در بازارهای پیش‌بینی سیاست و جنگ",
    numberOfItems: view.countries.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: view.countries.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.fa,
      url: `${site}${c.href}`,
    })),
  };

  return (
    <SiteChrome lang={lang} active="/world">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <WorldPb initial={view} renderedAt={nowMs()} />
    </SiteChrome>
  );
}
