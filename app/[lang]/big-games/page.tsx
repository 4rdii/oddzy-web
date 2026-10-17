import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { WhalesPb } from "@/components/pb/WhalesPb";
import { getWhalesToday } from "@/lib/api";
import { getDict } from "@/lib/dict";
import { isLocale } from "@/lib/i18n";
import { dayOf, faDay } from "@/lib/pb";

/**
 * «بازی‌های بزرگ امروز» / "Today's big games" (design: PB Big Games Whales).
 * Both brands: fa on PolyBaaz (RTL, Tehran time), en on Oddzy (LTR, the
 * viewer's own zone — the client re-formats the date and times after hydration).
 *
 * ISR window: 30 minutes, matched by the whales fetch (a route regenerates at
 * the LOWEST revalidate of any fetch it makes) — ~48 billed writes a day.
 * Finished games do not wait for it: the page watches each game from its
 * expected end (kickoff + 110 min) and moves it to the finished list as soon
 * as the live feed says it ended (see useEndedWatch in WhalesPb).
 */
export const revalidate = 1800;

export async function generateStaticParams() {
  return [{ lang: "fa" }, { lang: "en" }];
}

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { lang } = await props.params;
  if (!isLocale(lang)) return {};
  const t = getDict(lang).whales;
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { canonical: "/big-games" },
  };
}

export default async function BigGamesPage(props: Params) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  // "Today" is Tehran's day on PolyBaaz; Oddzy has no single home zone, so UTC.
  const data = await getWhalesToday(revalidate, lang === "fa" ? "Asia/Tehran" : "UTC");
  const iso = new Date().toISOString();
  return (
    <SiteChrome lang={lang} pb>
      <WhalesPb
        games={data?.games ?? []}
        finished={data?.finished ?? []}
        sports={data?.sports ?? []}
        generatedAt={data?.generated_at ?? null}
        dateLabel={lang === "fa" ? faDay(iso) : dayOf("en", iso, "UTC")}
        dateIso={iso}
        lang={lang}
        t={getDict(lang).whales}
      />
    </SiteChrome>
  );
}
