import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { TradersPb } from "@/components/pb/TradersPb";
import { getTraders } from "@/lib/api";
import { getDict } from "@/lib/dict";
import { isLocale, LOCALES } from "@/lib/i18n";

/** One list of the trader library: a category, "in form", or bots. See ../page.tsx. */
export const revalidate = 21600;

/** Must match oddzy-api traders.js LISTS, minus "all" (that is /traders). */
const LISTS = ["hot", "sports", "baskets", "combos", "esports", "crypto", "politics", "geopolitics", "middle_east", "economy", "tech", "culture", "mentions", "weather", "bots"];

export async function generateStaticParams() {
  return LOCALES.flatMap((lang) => LISTS.map((list) => ({ lang, list })));
}
export const dynamicParams = false;

type Params = { params: Promise<{ lang: string; list: string }> };

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { lang, list } = await props.params;
  if (!isLocale(lang) || !LISTS.includes(list)) return {};
  const t = getDict(lang).traders;
  const cat = (t.lists as Record<string, string>)[list] ?? list;
  const named = (t.listTitles as Record<string, string>)[list];
  return {
    title: named ? t.metaTitleNamed.replace("{title}", named) : t.metaTitleList.replace("{cat}", cat),
    description: t.metaDescription,
    alternates: { canonical: `/traders/${list}` },
  };
}

export default async function TradersListPage(props: Params) {
  const { lang, list } = await props.params;
  if (!isLocale(lang) || !LISTS.includes(list)) notFound();
  const data = await getTraders(list, revalidate);
  return (
    <SiteChrome lang={lang} pb>
      <TradersPb data={data} list={list} lang={lang} t={getDict(lang).traders} />
    </SiteChrome>
  );
}
