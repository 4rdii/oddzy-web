import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommunityFeed } from "@/components/baskets/CommunityFeed";
import { LocaleProvider } from "@/components/app/LocaleProvider";
import { PrivyRoot } from "@/components/app/PrivyRoot";
import { brandFor, isLocale } from "@/lib/i18n";
import { getDict } from "@/lib/dict";

/**
 * The community basket feed.
 *
 * Like the builder, this is a trading-surface page at a marketing-shaped URL:
 * PrivyRoot + noindex. Following needs a credential, and the standing rule is
 * that the auth SDK never loads on a crawlable page.
 *
 * The SEO surface for baskets is the individual /baskets/<slug> pages (plain
 * cacheable HTML, index:true, listed in the sitemap). /basket, the old
 * editorial index, now 308s here and is no longer in the sitemap — this page
 * is for people who already arrived.
 *
 * The list is fetched client-side rather than server-rendered: it is
 * personalised per viewer (follow state) and would otherwise have to be
 * no-store, which is what just cost this project most of a month's CPU budget
 * on the up/down desk. Static shell, personalised payload.
 */

const CREATOR_SHARE_PCT = Number(process.env.CREATOR_FEE_SHARE_PCT ?? 10);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: isLocale(lang) ? getDict(lang).communityBaskets.metaTitle : "Community baskets",
    robots: { index: false, follow: false },
  };
}

export const revalidate = 3600;

export default async function CommunityBasketsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDict(lang);
  const brand = brandFor(lang);

  return (
    <LocaleProvider value={{ locale: lang, brand, t, rtl: brand.dir === "rtl" }}>
      <PrivyRoot>
        <main className="mx-auto max-w-[1100px] px-4 py-8">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[24px] font-extrabold text-[var(--ink)]">
                {t.communityBaskets.h1}
              </h1>
              <p className="mt-1 max-w-[560px] text-[14px] leading-relaxed text-[var(--mute)]">
                {t.communityBaskets.lead.replace("{pct}", String(CREATOR_SHARE_PCT))}
              </p>
            </div>
            <a
              href="/baskets/new"
              className="shrink-0 rounded-xl px-4 py-2.5 text-[14px] font-bold"
              style={{
                background: "var(--bk-cta)",
                color: "var(--bk-cta-ink)",
                boxShadow: "var(--bk-cta-shadow)",
              }}
            >
              {t.communityBaskets.newBasket}
            </a>
          </header>

          <CommunityFeed initial={[]} creatorSharePct={CREATOR_SHARE_PCT} />
        </main>
      </PrivyRoot>
    </LocaleProvider>
  );
}
