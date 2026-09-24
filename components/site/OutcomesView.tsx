import Link from "next/link";
import { MatchBoard } from "@/components/site/MatchBoard";
import type { QuestionOutcomes } from "@/lib/api";
import type { Dict } from "@/lib/dict";
import type { Locale } from "@/lib/i18n";
import { localized } from "@/lib/format";

/**
 * A multi-outcome question ("Brazil Presidential Election") — every outcome
 * on one page, most likely first.
 *
 * Polymarket prices each outcome as its own market; a page per candidate,
 * per number or per range was most of the site's standalone market pages.
 * Each outcome's /market/<slug> redirects here with ?m= and opens its row.
 */
export function OutcomesView({
  lang,
  t,
  outcomes,
  category,
  asOf,
}: {
  lang: Locale;
  t: Dict;
  outcomes: QuestionOutcomes;
  category: { id: string; name: string; name_fa: string | null } | null;
  asOf: string;
}) {
  return (
    <article className="mx-auto max-w-3xl px-5 pt-10 pb-10">
      {category && (
        <Link href={`/topic/${category.id}`} className="font-mono text-[11px] tracking-[0.06em] text-[var(--mute)]">
          {localized(lang, category.name, category.name_fa)}
        </Link>
      )}
      <h1 className="mt-3 text-[clamp(24px,4vw,34px)] leading-[1.2] font-bold tracking-[-0.02em]">
        {localized(lang, outcomes.title, outcomes.title_fa)}
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--text2)]">{t.series.outcomesLead}</p>

      <section className="mt-8">
        <h2 className="text-[17px] font-bold tracking-[-0.01em]">{t.series.outcomesBoardHeading}</h2>
        <p className="mt-1 text-[13px] text-[var(--mute)]">{t.match.boardLead}</p>
        <MatchBoard
          groups={[
            {
              key: "outcomes",
              label: t.series.outcomesBoardHeading,
              markets: outcomes.options.map((o) => ({
                slug: o.slug,
                title: o.label,
                title_fa: o.label_fa,
                p: o.probability ? o.probability.yes : null,
                yes: t.match.yes,
                no: t.match.no,
                h24: o.volume.h24 ?? 0,
                status: o.status,
                outcome: o.outcome,
              })),
            },
          ]}
          lang={lang}
          labels={{
            showAll: t.match.showAll,
            showFewer: t.match.showFewer,
            rulesLoading: t.match.rulesLoading,
            rulesUnavailable: t.match.rulesUnavailable,
            resolved: t.match.resolved,
            tradeMarket: t.cta.tradeThisMarket,
            vol24: t.match.vol24,
            tablist: t.series.outcomesBoardHeading,
          }}
        />
      </section>

      <p className="mt-6 font-mono text-[11px] text-[var(--faint)]">
        {t.match.asOf} <span className="ltr-num">{new Date(asOf).toISOString().slice(0, 16).replace("T", " ")}</span> UTC ·{" "}
        {t.market.source}
      </p>
    </article>
  );
}
