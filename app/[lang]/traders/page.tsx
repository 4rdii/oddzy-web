import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { TradersPb } from "@/components/pb/TradersPb";
import { getTraders } from "@/lib/api";
import { getDict } from "@/lib/dict";
import { brandFor, isLocale } from "@/lib/i18n";
import { tradersJsonLd, tradersMetadata } from "@/components/pb/tradersSeo";

/**
 * Trader library, the overall list. Both brands: «کتابخانهٔ تریدرها» on
 * PolyBaaz, "Trader library" on Oddzy. Category lists live at /traders/[list].
 *
 * ISR window: six hours. The data behind it is rebuilt once a night
 * (oddzy-api build-traders.mjs), so anything shorter only buys billed writes.
 */
export const revalidate = 21600;

export async function generateStaticParams() {
  return [{ lang: "fa" }, { lang: "en" }];
}

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { lang } = await props.params;
  if (!isLocale(lang)) return {};
  return tradersMetadata(getDict(lang).traders, "all");
}

export default async function TradersPage(props: Params) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  const data = await getTraders("all", revalidate);
  const dict = getDict(lang);
  const brand = brandFor(lang);
  return (
    <SiteChrome lang={lang} pb>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(tradersJsonLd(dict.traders, "all", data, brand.siteUrl, brand.name)).replace(/</g, "\\u003c") }}
      />
      <TradersPb data={data} list="all" lang={lang} t={dict.traders} />
    </SiteChrome>
  );
}
