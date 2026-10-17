import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getDict } from "@/lib/dict";
import { isLocale } from "@/lib/i18n";
import { WorldScreen } from "./WorldScreen";

/**
 * «نقشهٔ جهان» — PolyBaaz's /world (design: PB World Map.html). On Oddzy the
 * map IS the home page, so /world 308s to / (proxy.ts does it for the host;
 * this covers a direct /en/world hit).
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

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { lang } = await props.params;
  if (lang !== "fa") return {};
  const t = getDict(lang).world;
  return {
    // The design's own <title>, which already carries the brand: skip the layout's "· پلی‌باز" template.
    title: { absolute: t.metaTitle },
    description: t.metaDescription,
    alternates: { canonical: "/world" },
    openGraph: { title: t.metaTitle, description: t.metaDescription, url: "/world" },
  };
}

export default async function WorldPage(props: Params) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  if (lang === "en") permanentRedirect("/");
  return <WorldScreen lang={lang} revalidate={revalidate} />;
}
