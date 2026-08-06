import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { getIndexableMarkets, getMarketDetail, getQuestionSeries } from "@/lib/api";
import { BRANDS, brandFor, isLocale, LOCALES, type Locale } from "@/lib/i18n";
import { getDict } from "@/lib/dict";
import { compactUsd, deadlineDate, localized, pct } from "@/lib/format";
import { PriceHistory } from "@/components/site/PriceHistory";

/**
 * One market, as a public page.
 *
 * This exists because of a gap we can actually fill: Persian searches like
 * «احتمال حمله آمریکا به ایران» return pundits guessing — a diplomat says 50%,
 * an analyst says 70% — while we hold a market with real money behind it saying
 * something specific. The number is the point of the page, and the resolution
 * rules underneath it are the part nobody else publishes in Persian.
 *
 * Only markets returned by /markets/indexable are prerendered, and everything
 * else is noindex: auto-publishing ~2000 pages, most with no volume, is thin
 * content, and a market whose Persian title was never verified must never be
 * cached by a search engine.
 */
export const revalidate = 600;

export async function generateStaticParams() {
  const markets = await getIndexableMarkets();
  return LOCALES.flatMap((lang) => markets.map((m) => ({ lang, slug: m.slug })));
}

/**
 * The question family this market belongs to, if any.
 *
 * A market that is one deadline of a rolling question ("…by August 15") is not
 * its own question — /question/<key> is. The lookup goes through the indexable
 * list because that is where the upstream reports the key, which keeps the
 * canonical tag and the sitemap reading from one source.
 */
async function seriesKeyFor(slug: string): Promise<string | null> {
  const markets = await getIndexableMarkets();
  return markets.find((m) => m.slug === slug)?.series_key ?? null;
}

type Params = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { lang, slug } = await props.params;
  if (!isLocale(lang)) return {};
  const detail = await getMarketDetail(slug);
  if (!detail) return {};
  const { market } = detail;
  const t = getDict(lang);
  const title = localized(lang, market.title, market.title_fa);
  const chance = pct(market.probability.yes);

  // A market that did not clear the publishing gate stays reachable but is not
  // offered to search: see the module comment.
  const indexable = (await getIndexableMarkets()).some((m) => m.slug === slug);
  const seriesKey = await seriesKeyFor(slug);

  const settled = market.status !== "active";
  return {
    // A settled market must not advertise a live percentage in the SERP — the
    // click lands on a page that answers the question, not one that forecasts it.
    title: settled
      ? `${title} — ${market.outcome === "YES" ? t.market.resolvedYes : t.market.resolvedNo}`
      : `${title} — ${chance}%`,
    description: settled
      ? t.market.metaDescriptionResolved
          .replace("{title}", title)
          .replace("{outcome}", market.outcome === "YES" ? t.market.resolvedYes : t.market.resolvedNo)
      : t.market.metaDescription
          .replace("{title}", title)
          .replace("{chance}", String(chance))
          .replace("{volume}", compactUsd(market.volume.h24)),
    // A rolling-deadline leg points its canonical at the family page instead of
    // competing with its own siblings for one query. Canonical ALONE, never
    // canonical + noindex: those are contradictory signals, and the risk is that
    // the noindex gets applied to the consolidated target too.
    alternates: {
      canonical: seriesKey ? `/question/${seriesKey}` : `/market/${slug}`,
      languages: Object.fromEntries(
        LOCALES.map((l) => [
          BRANDS[l].htmlLang,
          seriesKey
            ? `${BRANDS[l].siteUrl}/question/${seriesKey}`
            : `${BRANDS[l].siteUrl}/market/${slug}`,
        ]),
      ),
    },
    robots: indexable || seriesKey ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function MarketPage(props: Params) {
  const { lang, slug } = await props.params;
  if (!isLocale(lang)) notFound();
  const detail = await getMarketDetail(slug);
  if (!detail) notFound();

  const { market, history, as_of } = detail;
  const t = getDict(lang);
  // If this market is one deadline of a rolling question, load the family so
  // the page can point forward to the leg that is live now. Without this a
  // resolved page is a dead end: it answers a question whose date has passed and
  // gives the reader nowhere to go, which is exactly when they want the next one.
  const seriesKey = await seriesKeyFor(slug);
  const series = seriesKey ? await getQuestionSeries(seriesKey) : null;
  const currentLeg = series?.members.find((m) => m.current) ?? null;
  const isCurrentLeg = currentLeg?.slug === slug;
  const brand = brandFor(lang);
  const title = localized(lang, market.title, market.title_fa);
  const rules = lang === "fa" ? market.description_fa ?? market.description : market.description;
  // The rules were translated from the English; if we are showing the English
  // fallback inside a Persian page, mark it so the paragraph stays LTR.
  const rulesAreEnglish = lang === "fa" && !market.description_fa;
  const resolved = market.status !== "active";
  const outcomeKnown = market.outcome !== null;
  const isYes = market.outcome === "YES";
  const chance = pct(market.probability.yes);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: title,
      text: rules ?? title,
      dateModified: as_of,
      answerCount: 1,
      acceptedAnswer: {
        "@type": "Answer",
        // The claim is the market price, attributed as such — never phrased as
        // our own prediction.
        text: t.market.answer
          .replace("{chance}", String(chance))
          .replace("{volume}", compactUsd(market.volume.h24)),
        url: `${brand.siteUrl}/market/${slug}`,
      },
    },
    inLanguage: brand.htmlLang,
  };

  return (
    <SiteChrome lang={lang}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="mx-auto max-w-2xl px-5 pt-10 pb-10">
        {market.category && (
          <Link
            href={`/topic/${market.category.id}`}
            className="font-mono text-[11px] tracking-[0.06em] text-[var(--mute)]"
          >
            {localized(lang, market.category.name, market.category.name_fa)}
          </Link>
        )}

        <h1 className="mt-3 text-[clamp(24px,4vw,34px)] leading-[1.2] font-bold tracking-[-0.02em]">
          {title}
        </h1>

        {/* One leg of a rolling question. Say so, and hand the reader the leg
            that is actually live — a settled page with no way forward is where
            the visit ends. */}
        {series && currentLeg && !isCurrentLeg && (
          <p className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-[13px] leading-relaxed text-[var(--text2)]">
            {resolved ? t.series.successorLead : t.market.partOfSeries.replace(
              "{date}",
              deadlineDate(market.close_time, lang),
            )}{" "}
            <Link href={`/question/${seriesKey}`} className="font-medium underline">
              {t.market.seeCurrent}
            </Link>
          </p>
        )}

        {/* A settled market has no "chance" left, so showing 99.95% under the
            label "probability, according to the market" would be actively
            misleading — the question is answered, and the answer is the news.
            Live markets lead with the number and the stake behind it, because a
            percentage nobody backed is just an opinion. */}
        {resolved ? (
          <section className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
            <p className="font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]">
              {t.market.resolvedNotice}
            </p>
            <p
              className={`mt-2 text-[34px] leading-tight font-bold ${
                isYes ? "text-[var(--up)]" : "text-[var(--down)]"
              }`}
            >
              {isYes ? t.market.resolvedYes : outcomeKnown ? t.market.resolvedNo : t.market.resolvedUnknown}
            </p>
            <p className="mt-3 text-[13px] text-[var(--mute)]">
              {t.market.resolvedSub.replace("{volume}", "")}
              <span className="ltr-num">{compactUsd(market.volume.total)}</span>
              {t.market.resolvedSubSuffix}
            </p>
          </section>
        ) : (
          <section className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
            <div className="flex items-baseline gap-3">
              <span className="text-[44px] leading-none font-bold text-[var(--up)]">
                <span className="ltr-num">{chance}%</span>
              </span>
              <span className="text-[15px] text-[var(--text2)]">{t.market.chanceYes}</span>
            </div>
            <p className="mt-3 text-[13px] text-[var(--mute)]">
              {t.market.backedBy.replace("{volume}", "")}
              <span className="ltr-num">{compactUsd(market.volume.h24)}</span>
              {t.market.backedBySuffix}
            </p>
          </section>
        )}

        <PriceHistory history={history} lang={lang} labels={t.market.history} />

        {rules && (
          <section className="mt-8">
            <h2 className="text-[17px] font-bold tracking-[-0.01em]">{t.market.rulesHeading}</h2>
            <p className="mt-2 text-[13px] text-[var(--mute)]">{t.market.rulesLead}</p>
            <div
              className="mt-4 rounded-2xl border border-[var(--line)] p-5 text-[15px] leading-relaxed whitespace-pre-line text-[var(--text2)]"
              {...(rulesAreEnglish ? { lang: "en", dir: "ltr" as const } : {})}
            >
              {rules}
            </div>
          </section>
        )}

        <section className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="text-[15px] leading-relaxed">{t.market.ctaLead}</p>
          <a
            href={`https://t.me/${brand.tgBot}`}
            className="mt-4 inline-block rounded-xl bg-[var(--accent)] px-5 py-3 text-[15px] font-semibold text-[var(--on-accent)]"
          >
            {t.cta.openTelegram}
          </a>
        </section>

        <p className="mt-6 font-mono text-[11px] text-[var(--faint)]">
          {t.market.asOf} <span className="ltr-num">{new Date(as_of).toISOString().slice(0, 16).replace("T", " ")}</span> UTC
          {" · "}
          <a href={market.url} rel="nofollow noopener" className="underline">
            {t.market.source}
          </a>
        </p>
      </article>
    </SiteChrome>
  );
}
