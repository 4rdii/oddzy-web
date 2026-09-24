import Link from "next/link";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { getQuestionSeries, getQuestionSeriesIndex } from "@/lib/api";
import { BRANDS, brandFor, isLocale, LOCALES } from "@/lib/i18n";
import { getDict } from "@/lib/dict";
import { compactUsd, deadlineDate, localized, pct } from "@/lib/format";
import { PriceHistory } from "@/components/site/PriceHistory";
import { RelatedGuides } from "@/components/site/RelatedGuides";
import { SeriesTimeline } from "@/components/site/SeriesTimeline";
import { LadderView } from "@/components/site/LadderView";
import { OutcomesView } from "@/components/site/OutcomesView";

/**
 * One rolling question, as a permanent page.
 *
 * Polymarket re-lists the same question at successive deadlines — "Strait of
 * Hormuz traffic returns to normal by July 31 / August 15 / August 31 /
 * September 30 / December 31". Giving each its own indexed page has two
 * failures: five near-identical pages split the ranking for one query, and each
 * page's authority dies on its own deadline. This URL is stable across the
 * whole family: it always shows the leg that is live now, and accumulates the
 * ones that have resolved as the record underneath.
 *
 * The individual /market/<slug> pages stay reachable and canonicalize here.
 */
/**
 * ISR window. Deliberately an hour, and deliberately matched by the fetch
 * inside the page: a route revalidates at the LOWEST revalidate of any fetch it
 * makes, so raising this number alone would have changed nothing.
 *
 * Every regeneration is a billed ISR write, and this route is ~116 of them
 * across the two locales — enough that ordinary crawler traffic, not users,
 * exhausted a 200k/month quota in August 2026. Nothing here needs 10-minute
 * freshness: the upstream snapshot only moves every ~30 min, and the live
 * numbers are in the mini-app, which is not cached at all.
 */
export const revalidate = 3600;

export async function generateStaticParams() {
  const series = await getQuestionSeriesIndex();
  return LOCALES.flatMap((lang) => series.map((s) => ({ lang, key: s.key })));
}

type Params = { params: Promise<{ lang: string; key: string }> };

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { lang, key } = await props.params;
  if (!isLocale(lang)) return {};
  const series = await getQuestionSeries(key);
  if (!series || series.moved_to) return {};
  const t = getDict(lang);
  const alternates = {
    canonical: `/question/${key}`,
    languages: Object.fromEntries(LOCALES.map((l) => [BRANDS[l].htmlLang, `${BRANDS[l].siteUrl}/question/${key}`])),
  };
  // Ladders and multi-outcome questions are indexed only when they cleared
  // the publishing gate (/markets/series); the rest render as noindex.
  const published = (await getQuestionSeriesIndex()).some((s) => s.key === key);
  const robots = published ? { index: true, follow: true } : { index: false, follow: true };
  if (series.outcomes) {
    const o = series.outcomes;
    const title = localized(lang, o.title, o.title_fa);
    const leader = o.options.find((x) => x.status === "active" && x.probability);
    return {
      title: t.series.outcomesMetaTitle.replace("{title}", title),
      description: leader?.probability
        ? t.series.outcomesMetaDescription
            .replace("{title}", title)
            .replace("{leader}", lang === "fa" ? leader.label_fa ?? leader.label : leader.label)
            .replace("{chance}", String(pct(leader.probability.yes)))
            .replace("{count}", String(o.options.length))
        : title,
      alternates,
      robots,
    };
  }
  if (series.ladder) {
    const l = series.ladder;
    const asset = lang === "fa" ? l.asset.name_fa ?? l.asset.name : l.asset.name;
    const tf = t.series.ladderTimeframes[l.timeframe] ?? l.timeframe;
    return {
      title: t.series.ladderMetaTitle.replace("{asset}", asset).replace("{timeframe}", tf),
      description: t.series.ladderMetaDescription.replace("{asset}", asset).replace("{timeframe}", tf),
      alternates,
      robots,
    };
  }
  const { market } = series;
  const title = localized(lang, market.title, market.title_fa);
  const resolved = market.status !== "active";

  return {
    // The headline carries the CURRENT leg's number, because that is what the
    // page shows above the fold and a SERP snippet must not promise otherwise.
    title: resolved
      ? `${title} — ${market.outcome === "YES" ? t.market.resolvedYes : t.market.resolvedNo}`
      : `${title} — ${pct(market.probability.yes)}%`,
    description: (resolved ? t.series.metaDescriptionResolved : t.series.metaDescription).replace(
      "{title}",
      title,
    ),
    alternates: {
      canonical: `/question/${key}`,
      languages: Object.fromEntries(
        LOCALES.map((l) => [BRANDS[l].htmlLang, `${BRANDS[l].siteUrl}/question/${key}`]),
      ),
    },
    robots: { index: true, follow: true },
  };
}

export default async function QuestionPage(props: Params) {
  const { lang, key } = await props.params;
  if (!isLocale(lang)) notFound();
  const series = await getQuestionSeries(key);
  if (!series) notFound();
  // Old one-price-level pages ("will-bitcoin-reach-70-000") now live on their
  // asset/time-frame ladder page.
  if (series.moved_to) permanentRedirect(`/question/${series.moved_to}`);

  const { market, history, members, as_of } = series;
  const t = getDict(lang);
  if (series.outcomes) {
    return (
      <SiteChrome lang={lang}>
        <OutcomesView lang={lang} t={t} outcomes={series.outcomes} category={market.category} asOf={as_of} />
      </SiteChrome>
    );
  }
  if (series.ladder) {
    return (
      <SiteChrome lang={lang}>
        <LadderView lang={lang} t={t} ladder={series.ladder} category={market.category} asOf={as_of} />
      </SiteChrome>
    );
  }
  const brand = brandFor(lang);
  const title = localized(lang, market.title, market.title_fa);
  const rules = lang === "fa" ? (market.description_fa ?? market.description) : market.description;
  const rulesAreEnglish = lang === "fa" && !market.description_fa;
  const resolved = market.status !== "active";
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
        text: t.market.answer
          .replace("{chance}", String(chance))
          .replace("{volume}", compactUsd(market.volume.h24)),
        url: `${brand.siteUrl}/question/${key}`,
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

        <p className="mt-3 font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]">
          {t.series.currentHeading} ·{" "}
          <span className="ltr-num">
            {t.series.currentDeadline.replace("{date}", deadlineDate(market.close_time, lang))}
          </span>
        </p>

        {resolved ? (
          <section className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
            <p className="font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]">
              {t.market.resolvedNotice}
            </p>
            <p
              className={`mt-2 text-[34px] leading-tight font-bold ${
                isYes ? "text-[var(--up)]" : "text-[var(--down)]"
              }`}
            >
              {isYes
                ? t.market.resolvedYes
                : market.outcome !== null
                  ? t.market.resolvedNo
                  : t.market.resolvedUnknown}
            </p>
            {/* Every leg is settled — say so, rather than leaving a reader to
                wonder whether a newer deadline exists somewhere. */}
            <p className="mt-3 text-[13px] text-[var(--mute)]">{t.series.noSuccessor}</p>
          </section>
        ) : (
          <section className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
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

        <SeriesTimeline members={members} lang={lang} labels={t.series} />

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

        <RelatedGuides
          categoryId={market.category?.id}
          lang={lang}
          heading={t.guides.heading}
          lead={t.guides.marketLead}
        />

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
          {t.market.asOf}{" "}
          <span className="ltr-num">
            {new Date(as_of).toISOString().slice(0, 16).replace("T", " ")}
          </span>{" "}
          UTC
          {" · "}
          <a href={market.url} rel="nofollow noopener" className="underline">
            {t.market.source}
          </a>
        </p>
      </article>
    </SiteChrome>
  );
}
