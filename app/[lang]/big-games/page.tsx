import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { WhalesPb } from "@/components/pb/WhalesPb";
import { getWhalesToday } from "@/lib/api";
import { isLocale } from "@/lib/i18n";
import { faDay } from "@/lib/pb";

/**
 * «بازی‌های بزرگ امروز» — PolyBaaz only (design: PB Big Games Whales).
 *
 * ISR window: 30 minutes, matched by the whales fetch (a route regenerates at
 * the LOWEST revalidate of any fetch it makes) — ~48 billed writes a day.
 * Finished games do not wait for it: the page watches each game from its
 * expected end (kickoff + 110 min) and moves it to the finished list as soon
 * as the live feed says it ended (see useEndedWatch in WhalesPb).
 */
export const revalidate = 1800;

export async function generateStaticParams() {
  return [{ lang: "fa" }];
}

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { lang } = await props.params;
  if (lang !== "fa") return {};
  return {
    title: "بازی‌های بزرگ امروز و پیش‌بینی نهنگ‌ها",
    description:
      "پرمعامله‌ترین بازی‌های امروز و بزرگ‌ترین پیش‌بینی‌هایی که نهنگ‌ها پیش از شروع بازی ثبت کرده‌اند، با امتیاز سابقهٔ واقعی هر کدام و مقایسه با شانسی که بازار می‌دهد.",
    alternates: { canonical: "/big-games" },
  };
}

export default async function BigGamesPage(props: Params) {
  const { lang } = await props.params;
  // Persian-only page: the design, copy and audience are PolyBaaz's.
  if (!isLocale(lang) || lang !== "fa") notFound();
  const data = await getWhalesToday(revalidate);
  return (
    <SiteChrome lang={lang}>
      <WhalesPb games={data?.games ?? []} finished={data?.finished ?? []} sports={data?.sports ?? []} generatedAt={data?.generated_at ?? null} dateLabel={faDay(new Date().toISOString())} />
    </SiteChrome>
  );
}
