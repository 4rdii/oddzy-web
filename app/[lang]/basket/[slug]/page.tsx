import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { getBasket, getBaskets, type BasketDetail } from "@/lib/api";
import { BRANDS, brandFor, isLocale, LOCALES } from "@/lib/i18n";
import { getDict } from "@/lib/dict";
import { compactUsd, deadlineDate, localized, pct, usd } from "@/lib/format";

/**
 * One basket: what it holds, at what weight, and what it currently costs.
 *
 * The page deliberately shows each leg's OWN price (`leg.price`), not the
 * market's YES probability — a basket that holds the NO side of a question at
 * 17% is a position costing 83¢, and showing 17 next to it would misstate the
 * cost of every such row.
 */
/**
 * ISR window. Deliberately an hour, and deliberately matched by the fetch
 * inside the page: a route revalidates at the LOWEST revalidate of any fetch it
 * makes, so raising this number alone would have changed nothing.
 *
 * Every regeneration is a billed ISR write, and this route is ~22 of them
 * across the two locales — enough that ordinary crawler traffic, not users,
 * exhausted a 200k/month quota in August 2026. Nothing here needs 10-minute
 * freshness: the upstream snapshot only moves every ~30 min, and the live
 * numbers are in the mini-app, which is not cached at all.
 */
export const revalidate = 3600;

/**
 * The single payout figure when every winner pays the same, else null.
 *
 * Prefers the server's `single_even` and falls back to collapsing a low/high
 * pair that differ by under 1%. Equal-shares sizing rounds to whole cents, so
 * the ends land a penny apart — and "returns between $144.92 and $144.93" reads
 * as though the winner changes the payout, which is exactly what this sizing
 * mode exists to prevent.
 */
function evenPayout(p: NonNullable<BasketDetail["payout"]>): number | null {
  if (p.single_even !== null) return p.single_even;
  if (p.single_high <= 0) return null;
  return (p.single_high - p.single_low) / p.single_high <= 0.01
    ? (p.single_low + p.single_high) / 2
    : null;
}

export async function generateStaticParams() {
  const baskets = await getBaskets();
  return LOCALES.flatMap((lang) => baskets.map((b) => ({ lang, slug: b.slug })));
}

type Params = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { lang, slug } = await props.params;
  if (!isLocale(lang)) return {};
  const basket = await getBasket(slug);
  if (!basket) return {};
  const t = getDict(lang);
  const title = localized(lang, basket.title, basket.title_fa);
  const count = String(basket.leg_count);

  return {
    title: t.basket.metaTitle.replace("{title}", title).replace("{count}", count),
    description: t.basket.metaDescription
      .replace("{title}", title)
      .replace("{count}", count),
    alternates: {
      canonical: `/basket/${slug}`,
      languages: Object.fromEntries(
        LOCALES.map((l) => [BRANDS[l].htmlLang, `${BRANDS[l].siteUrl}/basket/${slug}`]),
      ),
    },
    robots: { index: true, follow: true },
  };
}

export default async function BasketPage(props: Params) {
  const { lang, slug } = await props.params;
  if (!isLocale(lang)) notFound();
  const basket = await getBasket(slug);
  if (!basket) notFound();

  const t = getDict(lang);
  const brand = brandFor(lang);
  const title = localized(lang, basket.title, basket.title_fa);
  const description = localized(lang, basket.description ?? "", basket.description_fa);
  const settled = basket.status !== "active";

  return (
    <SiteChrome lang={lang}>
      <article className="mx-auto max-w-2xl px-5 pt-10 pb-10">
        <Link
          href="/basket"
          className="font-mono text-[11px] tracking-[0.06em] text-[var(--mute)]"
        >
          {t.basket.indexH1}
        </Link>

        <h1 className="mt-3 text-[clamp(24px,4vw,34px)] leading-[1.2] font-bold tracking-[-0.02em]">
          {title}
        </h1>
        {description && (
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--text2)]">{description}</p>
        )}

        <p className="mt-3 font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]">
          <span className="ltr-num">
            {t.basket.legCount.replace("{count}", String(basket.leg_count))}
          </span>
          {basket.stats.buys > 0 && (
            <>
              {" · "}
              <span className="ltr-num">
                {t.basket.buys.replace("{count}", String(basket.stats.buys))}
              </span>
            </>
          )}
          {basket.curated && <> {" · "}{t.basket.curated}</>}
        </p>

        {basket.blended_probability !== null && (
          <section className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
            <p className="font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]">
              {t.basket.blendedHeading}
            </p>
            <p className="mt-2 text-[44px] leading-none font-bold text-[var(--up)]">
              <span className="ltr-num">{pct(basket.blended_probability)}%</span>
            </p>
            <p className="mt-3 text-[13px] text-[var(--mute)]">{t.basket.blendedLead}</p>
          </section>
        )}

        {/* What it pays if it comes good. Quoted per $100 because the page has
            no stake input; the bot and mini app show the real figure once a size
            is chosen. An exclusive basket gets the single-winner range instead
            of an "all hit" total, which for it is unreachable. */}
        {basket.payout && !settled && (
          <section className="mt-4 rounded-2xl border border-[var(--line)] p-5">
            <p className="font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]">
              {t.basket.payoutHeading}
            </p>
            {basket.payout.all_hit !== null ? (
              <p className="mt-2 text-[15px] leading-relaxed">
                {t.basket.payoutAllHit
                  .replace("{amount}", usd(basket.payout.all_hit))
                  .replace("{stake}", usd(basket.payout.notional))
                  .replace("{multiple}", String(basket.payout.multiple))}
              </p>
            ) : evenPayout(basket.payout) !== null ? (
              /* Equal-shares sizing: every winner pays the same, so state one
                 figure. A range here would imply the outcome changes the
                 payout when the whole point is that it doesn't. */
              <>
                <p className="mt-2 text-[15px] leading-relaxed">
                  {t.basket.payoutEven
                    .replace("{stake}", usd(basket.payout.notional))
                    .replace("{amount}", usd(evenPayout(basket.payout)!))
                    .replace(
                      "{multiple}",
                      (evenPayout(basket.payout)! / basket.payout.notional).toFixed(2),
                    )}
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--mute)]">
                  {t.basket.payoutEvenLead}
                </p>
              </>
            ) : (
              <p className="mt-2 text-[15px] leading-relaxed">
                {t.basket.payoutRange
                  .replace("{stake}", usd(basket.payout.notional))
                  .replace("{low}", usd(basket.payout.single_low))
                  .replace("{high}", usd(basket.payout.single_high))}
              </p>
            )}
            {/* Only when the floor is genuinely a loss — an even split across a
                short-priced favourite. Saying it unconditionally would cry wolf
                on baskets where every winner turns a profit. */}
            {basket.payout.all_hit === null &&
              evenPayout(basket.payout) === null &&
              basket.payout.single_low < basket.payout.notional && (
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--mute)]">
                  {t.basket.payoutRangeWarn}
                </p>
              )}
          </section>
        )}

        {settled && (
          <p className="mt-4 text-[13px] text-[var(--mute)]">{t.basket.settled}</p>
        )}

        {/* Stated above the legs, not buried with the fine print: "buy several
            positions at once" reads as a parlay to anyone who has used a
            sportsbook, and that misreading changes what they think they bought. */}
        <p className="mt-4 rounded-2xl border border-[var(--line)] p-4 text-[13px] leading-relaxed text-[var(--text2)]">
          {t.basket.notParlay}
        </p>

        <section className="mt-8">
          <h2 className="text-[17px] font-bold tracking-[-0.01em]">{t.basket.legsHeading}</h2>
          <p className="mt-2 text-[13px] text-[var(--mute)]">{t.basket.legsLead}</p>

          <ul className="mt-4 space-y-2">
            {basket.legs.map((leg) => {
              const legTitle = localized(lang, leg.market.title, leg.market.title_fa);
              const legResolved = leg.market.status !== "active";
              return (
                <li
                  key={leg.market.id}
                  className="rounded-2xl border border-[var(--line)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/market/${leg.market.slug}`}
                      className="text-[15px] leading-snug font-medium"
                    >
                      {legTitle}
                    </Link>
                    <span className="ltr-num shrink-0 font-mono text-[13px] font-bold">
                      {leg.weight_pct}%
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]">
                    {leg.side === "YES" ? t.series.resolvedYes : t.series.resolvedNo}
                    {" · "}
                    {/* The price of the side this basket holds, not the YES price. */}
                    {leg.price === null ? (
                      "—"
                    ) : (
                      <span className="ltr-num">{pct(leg.price)}%</span>
                    )}
                    {leg.market.close_time && (
                      <>
                        {" · "}
                        <span className="ltr-num">
                          {deadlineDate(leg.market.close_time, lang)}
                        </span>
                      </>
                    )}
                    {legResolved && <> {" · "}{t.series.resolvedUnknown}</>}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        {/* The partial-fill contract, stated on the page rather than only in the
            bot: a reader deciding whether to buy should know before they tap
            that legs are independent orders. */}
        <p className="mt-6 text-[13px] leading-relaxed text-[var(--mute)]">
          {t.basket.partialNotice}
        </p>

        {!settled && (
          <section className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
            <p className="text-[15px] leading-relaxed">{t.market.ctaLead}</p>
            <a
              href={`https://t.me/${brand.tgBot}?start=basket_${slug}`}
              className="mt-4 inline-block rounded-xl bg-[var(--accent)] px-5 py-3 text-[15px] font-semibold text-[var(--on-accent)]"
            >
              {t.basket.cta}
            </a>
          </section>
        )}

        <p className="mt-6 font-mono text-[11px] text-[var(--faint)]">
          {t.market.asOf}{" "}
          <span className="ltr-num">
            {new Date(basket.as_of).toISOString().slice(0, 16).replace("T", " ")}
          </span>{" "}
          UTC
          {basket.stats.volume_usdc ? (
            <>
              {" · "}
              <span className="ltr-num">{compactUsd(basket.stats.volume_usdc)}</span>
            </>
          ) : null}
        </p>
      </article>
    </SiteChrome>
  );
}
