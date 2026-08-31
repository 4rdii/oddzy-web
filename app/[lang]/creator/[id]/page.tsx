import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorProfile } from "@/components/baskets/CreatorProfile";
import { LocaleProvider } from "@/components/app/LocaleProvider";
import { PrivyRoot } from "@/components/app/PrivyRoot";
import { brandFor, isLocale } from "@/lib/i18n";
import { getDict } from "@/lib/dict";

/**
 * A creator's public profile.
 *
 * noindex, like the rest of the community surface. Not for SEO reasons — these
 * pages would be perfectly crawlable — but because the page needs the auth SDK
 * to offer a Follow button, and the rule here is that the SDK never loads on a
 * page we ask Google to index. It also keeps user-controlled display names out
 * of the index, which is the right default for a surface anyone can publish to.
 *
 * Rendered as a static shell with the profile fetched client-side: the content
 * is personalised (follow state) and would otherwise force this route dynamic
 * for every visitor.
 */

/**
 * ISR, not per-request rendering.
 *
 * There is nothing personalised in this SHELL — the profile itself is fetched
 * client-side — so leaving the route dynamic would mean a function invocation
 * and a full React render for every visit to every creator, to produce bytes
 * that never differ. That is precisely the pattern that ate most of a month's
 * Fluid Active CPU on the up/down desk. First hit renders, everyone after that
 * is served from the CDN.
 */
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: isLocale(lang) ? getDict(lang).creatorProfile.metaTitle : "Creator",
    robots: { index: false, follow: false },
  };
}

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  // Ids are bigints on the wire. Reject anything else here rather than handing
  // it to the API — a malformed id is a 400 there and a blank screen here.
  if (!/^-?\d{1,20}$/.test(id)) notFound();

  const t = getDict(lang);
  const brand = brandFor(lang);

  return (
    <LocaleProvider value={{ locale: lang, brand, t, rtl: brand.dir === "rtl" }}>
      <PrivyRoot>
        <main className="mx-auto max-w-[1100px] px-4 py-8">
          <a
            href={`/${lang}/baskets`}
            className="mb-5 inline-block text-[13px] font-semibold"
            style={{ color: "var(--bk-gold)" }}
          >
            ← {t.communityBaskets.h1}
          </a>
          <CreatorProfile creatorId={id} />
        </main>
      </PrivyRoot>
    </LocaleProvider>
  );
}
