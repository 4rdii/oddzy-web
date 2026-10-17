import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { LivePb, type HubLink } from "@/components/pb/LivePb";
import { getLive, type LiveBoard } from "@/lib/api";
import { getDict } from "@/lib/dict";
import { isLocale } from "@/lib/i18n";
import { publishedTopicSlugs } from "@/lib/topic-slugs";

/**
 * «زنده» — every game in play right now, across sports. PolyBaaz (fa) and
 * Oddzy (en) both serve it; the copy comes from the dictionary's `live` section.
 *
 * ISR window: 5 minutes, matched by the /live fetch (a route regenerates at
 * the LOWEST revalidate of any fetch it makes); every regeneration is a billed
 * write, so the page is not rebuilt at the data's pace. It does not need to
 * be: once hydrated it refreshes itself from /api/live at once and then every
 * 15s, which is CDN-cached and is not an ISR write. The server render is the
 * crawlable list of real links to the match pages.
 */
export const revalidate = 300;

export async function generateStaticParams() {
  return [{ lang: "fa" }, { lang: "en" }];
}

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { lang } = await props.params;
  if (!isLocale(lang)) return {};
  const { metaTitle, metaDescription } = getDict(lang).live;
  return {
    // PolyBaaz's title already carries the brand: skip the layout's "· پلی‌باز" template.
    // Oddzy's goes through it ("… · Oddzy").
    title: lang === "fa" ? { absolute: metaTitle } : metaTitle,
    description: metaDescription,
    alternates: { canonical: "/live" },
    openGraph: { title: metaTitle, description: metaDescription, url: "/live" },
  };
}

const EMPTY: LiveBoard = { sports: [], leagues: [], live: [], soon: [], finished: [], as_of: new Date(0).toISOString() };

/**
 * English only: the sports hubs linked under the heading, so the Sports tab
 * reaches them. A topic hub is linked only when its page really exists.
 */
const HUB_TOPICS = ["football", "epl", "ucl", "laliga", "seriea", "bundesliga", "tennis", "nba"] as const;
const MAX_HUB_TOPICS = 6;

async function hubLinks(t: ReturnType<typeof getDict>["live"]): Promise<HubLink[]> {
  const published = await publishedTopicSlugs().catch(() => new Set<string>());
  const topics = HUB_TOPICS.filter((s) => published.has(s))
    .slice(0, MAX_HUB_TOPICS)
    .map((s) => ({ href: `/topic/${s}`, label: t.hubs[s] }));
  return [{ href: "/big-games", label: t.hubs.bigGames }, ...topics];
}

export default async function LivePage(props: Params) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang).live;
  const [board, hubs] = await Promise.all([getLive(revalidate), lang === "en" ? hubLinks(t) : undefined]);
  return (
    <SiteChrome lang={lang} active="/live" pb>
      <LivePb initial={board ?? EMPTY} lang={lang} t={t} hubs={hubs} />
    </SiteChrome>
  );
}
