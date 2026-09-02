import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BasketBuilder } from "@/components/baskets/BasketBuilder";
import { LocaleProvider } from "@/components/app/LocaleProvider";
import { PrivyRoot } from "@/components/app/PrivyRoot";
import { getTopics } from "@/lib/api";
import { brandFor, isLocale } from "@/lib/i18n";
import { getDict } from "@/lib/dict";

/**
 * The basket builder.
 *
 * Lives at a marketing-shaped URL but is a TRADING-SURFACE page, and is built
 * like one: PrivyRoot + LocaleProvider, noindex. Publishing needs a credential,
 * and the codebase's standing rule is that the auth SDK never loads on a
 * crawlable page — the blog and the landing pages stay plain cacheable HTML.
 * Marking this noindex is what makes wrapping it in Privy consistent with that
 * rule rather than an exception to it.
 *
 * The market library is fetched client-side from /api/markets, which is already
 * CDN-cached for everyone. Only the topic tree is server-rendered, so the first
 * paint has its category pills without waiting on the browser.
 */

/**
 * The creator's share OF THE PLATFORM FEE, as a percent.
 *
 * The authoritative number is the bot's SHARER_REV_SHARE_BPS (10) measured
 * against MAX_BPS (100, the builder fee) — a tenth of what we take. It is
 * mirrored here rather than fetched because it is display copy on a page that
 * would otherwise need a round trip before it could render its own footer, and
 * env keeps it changeable without a code edit. If you move the bot's bps, move
 * this too; the comment in apps/bot/src/api/v1.ts says the same in reverse.
 */
const CREATOR_SHARE_PCT = Number(process.env.CREATOR_FEE_SHARE_PCT ?? 50);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: isLocale(lang) ? getDict(lang).basketBuilder.metaTitle : "Build a basket",
    robots: { index: false, follow: false },
  };
}

export const revalidate = 900;

export default async function NewBasketPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const t = getDict(lang);
  const brand = brandFor(lang);

  // Sections only. The pills are a top-level filter, and the full tree's leaves
  // would run to dozens of chips before anyone had picked anything.
  const topics = await getTopics().catch(() => []);

  return (
    <LocaleProvider
      value={{ locale: lang, brand, t, rtl: brand.dir === "rtl" }}
    >
      <PrivyRoot>
        <main className="mx-auto max-w-[1100px] px-4 py-8">
          <header className="mb-6">
            <h1 className="text-[24px] font-extrabold text-[var(--ink)]">
              {t.basketBuilder.h1}
            </h1>
            <p className="mt-1 max-w-[620px] text-[14px] leading-relaxed text-[var(--mute)]">
              {t.basketBuilder.lead.replace("{pct}", String(CREATOR_SHARE_PCT))}
            </p>
          </header>
          <BasketBuilder
            topics={topics.filter((x) => x.active_markets > 0)}
            creatorSharePct={CREATOR_SHARE_PCT}
          />
        </main>
      </PrivyRoot>
    </LocaleProvider>
  );
}
