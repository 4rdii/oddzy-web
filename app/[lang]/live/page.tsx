import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { LivePb } from "@/components/pb/LivePb";
import { getLive, type LiveBoard } from "@/lib/api";
import { isLocale } from "@/lib/i18n";

/**
 * «زنده» — every game in play right now, across sports. PolyBaaz only.
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
  return [{ lang: "fa" }];
}

type Params = { params: Promise<{ lang: string }> };

const TITLE = "بازی‌های زنده | پلی‌باز";
const DESCRIPTION = "همهٔ بازی‌هایی که همین حالا در جریان‌اند — فوتبال، تنیس و بقیه — با نتیجه، زمان بازی و شانس لحظه‌ای هر طرف در بازار پیش‌بینی.";

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { lang } = await props.params;
  if (lang !== "fa") return {};
  return {
    // Already carries the brand: skip the layout's "· پلی‌باز" template.
    title: { absolute: TITLE },
    description: DESCRIPTION,
    alternates: { canonical: "/live" },
    openGraph: { title: TITLE, description: DESCRIPTION, url: "/live" },
  };
}

const EMPTY: LiveBoard = { sports: [], leagues: [], live: [], soon: [], finished: [], as_of: new Date(0).toISOString() };

export default async function LivePage(props: Params) {
  const { lang } = await props.params;
  // Persian-only page: the design, copy and audience are PolyBaaz's.
  if (!isLocale(lang) || lang !== "fa") notFound();
  const board = (await getLive(revalidate)) ?? EMPTY;
  return (
    <SiteChrome lang={lang} active="/live">
      <LivePb initial={board} />
    </SiteChrome>
  );
}
