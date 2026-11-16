import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { TradersPb } from "@/components/pb/TradersPb";
import { getTraders } from "@/lib/api";
import { getDict } from "@/lib/dict";
import { isLocale } from "@/lib/i18n";

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
  const t = getDict(lang).traders;
  return { title: t.metaTitle, description: t.metaDescription, alternates: { canonical: "/traders" } };
}

export default async function TradersPage(props: Params) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  const data = await getTraders("all", revalidate);
  return (
    <SiteChrome lang={lang} pb>
      <TradersPb data={data} list="all" lang={lang} t={getDict(lang).traders} />
    </SiteChrome>
  );
}
