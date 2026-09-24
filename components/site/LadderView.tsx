import Link from "next/link";
import { MatchBoard, type BoardGroup } from "@/components/site/MatchBoard";
import type { Ladder } from "@/lib/api";
import type { Dict } from "@/lib/dict";
import type { Locale } from "@/lib/i18n";
import { localized } from "@/lib/format";

/**
 * One asset's price levels over one time frame ("Bitcoin price: daily") — the
 * body of a ladder question page.
 *
 * Polymarket lists a separate market per price level and per period; a page
 * per level was ~90 near-identical pages that differed only in a number.
 * Here each period is a tab and each level a row, the same board a match page
 * uses, so /market/<level> can redirect here with ?m= and open its row.
 */

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", Number.isInteger(n) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "Bitcoin price: daily" / «قیمت بیت‌کوین: روزانه». */
export function ladderName(lang: Locale, t: Dict, ladder: Pick<Ladder, "asset" | "timeframe">): string {
  const asset = lang === "fa" ? ladder.asset.name_fa ?? ladder.asset.name : ladder.asset.name;
  return t.series.ladderTitle
    .replace("{asset}", asset)
    .replace("{timeframe}", t.series.ladderTimeframes[ladder.timeframe] ?? ladder.timeframe);
}

function periodLabel(lang: Locale, t: Dict, ladder: Ladder, p: Ladder["periods"][number]): string {
  // English keeps the market's own wording ("September 25", "Week of
  // September 21"). Persian is rebuilt from the close date, Gregorian like
  // every other market date on the site.
  if (lang !== "fa" || !p.close_time) return p.label;
  const d = new Date(p.close_time);
  const day = d.toLocaleDateString("fa-IR-u-ca-gregory", { day: "numeric", month: "long", timeZone: "UTC" });
  switch (ladder.timeframe) {
    case "daily":
      return day;
    case "weekly":
      return t.series.ladderPeriodWeek.replace("{date}", day);
    case "monthly":
      return d.toLocaleDateString("fa-IR-u-ca-gregory", { month: "long", year: "numeric", timeZone: "UTC" });
    default:
      return t.series.ladderPeriodBy.replace(
        "{date}",
        d.toLocaleDateString("fa-IR-u-ca-gregory", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
      );
  }
}

function ladderGroups(lang: Locale, t: Dict, ladder: Ladder): BoardGroup[] {
  return ladder.periods.map((p) => ({
    key: p.key,
    label: periodLabel(lang, t, ladder, p),
    markets: p.rungs.map((r) => ({
      slug: r.slug,
      title: r.label,
      title_fa: (t.series.ladderDirs[r.dir] ?? "{a}")
        .replace("{a}", usd(r.amounts[0]))
        .replace("{b}", r.amounts[1] !== undefined ? usd(r.amounts[1]) : ""),
      p: r.probability ? r.probability.yes : null,
      yes: t.match.yes,
      no: t.match.no,
      h24: r.volume.h24 ?? 0,
      status: r.status,
      outcome: r.outcome,
    })),
  }));
}

export function LadderView({
  lang,
  t,
  ladder,
  category,
  asOf,
}: {
  lang: Locale;
  t: Dict;
  ladder: Ladder;
  category: { id: string; name: string; name_fa: string | null } | null;
  asOf: string;
}) {
  const asset = lang === "fa" ? ladder.asset.name_fa ?? ladder.asset.name : ladder.asset.name;
  return (
    <article className="mx-auto max-w-3xl px-5 pt-10 pb-10">
      {category && (
        <Link href={`/topic/${category.id}`} className="font-mono text-[11px] tracking-[0.06em] text-[var(--mute)]">
          {localized(lang, category.name, category.name_fa)}
        </Link>
      )}
      <h1 className="mt-3 text-[clamp(24px,4vw,34px)] leading-[1.2] font-bold tracking-[-0.02em]">
        {ladderName(lang, t, ladder)}
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--text2)]">
        {t.series.ladderLead.replace("{asset}", asset)}
      </p>

      <section className="mt-8">
        <h2 className="text-[17px] font-bold tracking-[-0.01em]">{t.series.ladderBoardHeading}</h2>
        <p className="mt-1 text-[13px] text-[var(--mute)]">{t.match.boardLead}</p>
        <MatchBoard
          groups={ladderGroups(lang, t, ladder)}
          lang={lang}
          labels={{
            showAll: t.match.showAll,
            showFewer: t.match.showFewer,
            rulesLoading: t.match.rulesLoading,
            rulesUnavailable: t.match.rulesUnavailable,
            resolved: t.match.resolved,
            tradeMarket: t.cta.tradeThisMarket,
            vol24: t.match.vol24,
            tablist: t.series.ladderBoardHeading,
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
