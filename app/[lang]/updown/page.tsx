import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { UpDownBoard } from "@/components/updown/UpDownBoard";
import { getUpDownWindows } from "@/lib/api";
import { BRANDS, isLocale, LOCALES } from "@/lib/i18n";
import { getDict } from "@/lib/dict";

/**
 * Crypto 15-minute up/down.
 *
 * `revalidate = 0`: the only uncached page on the site, and necessarily so.
 * Every other route here is a static render that exists to be crawled; this one
 * is a live instrument whose contents expire in under fifteen minutes. The
 * initial render seeds the board so there is something on screen immediately,
 * and the client takes over polling from there.
 *
 * Still indexable. The page describes a permanent product ("bet on 15-minute
 * bitcoin moves") even though the specific windows on it are ephemeral — the
 * same reason topic hubs outrank the markets underneath them.
 */
export const revalidate = 0;

export async function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { lang } = await props.params;
  if (!isLocale(lang)) return {};
  const t = getDict(lang);
  return {
    title: t.updown.metaTitle,
    description: t.updown.metaDescription,
    alternates: {
      canonical: "/updown",
      languages: Object.fromEntries(
        LOCALES.map((l) => [BRANDS[l].htmlLang, `${BRANDS[l].siteUrl}/updown`]),
      ),
    },
    robots: { index: true, follow: true },
  };
}

export default async function UpDownPage(props: Params) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();

  const t = getDict(lang);
  const { windows, settled } = await getUpDownWindows();

  return (
    <SiteChrome lang={lang}>
      <div className="mx-auto max-w-3xl px-5 pt-12 pb-4">
        <h1 className="text-[clamp(26px,4.5vw,38px)] font-bold tracking-[-0.03em]">
          {t.updown.h1}
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--text2)]">
          {t.updown.lead}
        </p>

        {/*
          The resolution rule, stated in full and never abbreviated to "will it
          go up?". These resolve on the average across the window versus the
          opening price, so a market can finish exactly where it started and
          still resolve Up. Shortening this sentence would mislead in the
          direction that costs the reader money on a bet they believed they won.
        */}
        <p className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3 text-[13px] leading-relaxed text-[var(--mute)]">
          {t.updown.rule}
        </p>
      </div>

      <div className="mx-auto max-w-3xl px-5 pb-16">
        <UpDownBoard
          initial={windows}
          initialSettled={settled}
          locale={lang}
          copy={{
            heading: t.updown.h1,
            lead: t.updown.lead,
            rule: t.updown.rule,
            none: t.updown.none,
            closesIn: t.updown.closesIn,
            up: t.updown.up,
            down: t.updown.down,
            volume: t.updown.volume,
            waiting: t.updown.waiting,
            resolved: t.updown.resolved,
            resolvedUp: t.updown.resolvedUp,
            resolvedDown: t.updown.resolvedDown,
            closing: t.updown.closing,
            notStarted: t.updown.notStarted,
            loadingPrices: t.updown.loadingPrices,
            anchor: t.updown.anchor,
            average: t.updown.average,
            price: t.updown.price,
          }}
        />
      </div>
    </SiteChrome>
  );
}
