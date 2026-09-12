import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { BasketCtas } from "@/components/baskets/BasketCtas";
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
      canonical: `/baskets/${slug}`,
      languages: Object.fromEntries(
        LOCALES.map((l) => [BRANDS[l].htmlLang, `${BRANDS[l].siteUrl}/baskets/${slug}`]),
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

  /**
   * How one leg finished. `outcome` stays null until the market actually
   * resolves, which is NOT the same as the basket being closed: the expiry
   * sweep archives a basket at close time, so an archived basket routinely
   * holds legs whose result is still pending. Those must read as pending —
   * folding them into "lost" would invent a result the market never gave.
   */
  const legState = (leg: BasketDetail["legs"][number]) =>
    leg.market.outcome == null
      ? "pending"
      : leg.market.outcome === "VOID"
        ? "void"
        : leg.market.outcome === leg.side
          ? "won"
          : "lost";

  /**
   * Render as a record rather than an offer. Gated on `archived` as well as
   * `settled` because those diverge over exactly the window that matters:
   * kickoff has passed so nothing is buyable, but no result has landed yet.
   * Gating on `settled` alone would show a buy button on a dead basket.
   */
  const isRecord = basket.archived || settled;
  const decidedLegs = basket.legs.filter((l) => legState(l) !== "pending");
  const wonLegs = basket.legs.filter((l) => legState(l) === "won").length;

  // Per-leg colours for the weight bar, in the handoff's order.
  const LEG_COLORS = [
    "var(--bk-gold)", "#b08d2f", "#8a6f2a", "#6b5620", "#d9b356",
    "#a3853a", "#7d6a2e", "#5c4d1e", "#c9a44a", "#948038",
  ];

  return (
    <SiteChrome lang={lang}>
      <article className="mx-auto max-w-[1000px] px-5 pt-8 pb-12">
        <Link href="/baskets" className="font-mono text-[11px] tracking-[0.06em] text-[var(--mute)]">
          ← {t.basket.indexH1}
        </Link>

        {/* Hero */}
        <p
          className="mt-5 font-mono text-[11px] tracking-[0.14em]"
          style={{ color: "var(--bk-gold)" }}
        >
          {basket.curated ? t.basket.eyebrowEditorial : t.basket.eyebrowCommunity}
        </p>
        <h1 className="mt-2 text-[clamp(26px,5vw,38px)] leading-[1.15] font-extrabold tracking-[-0.02em]">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-[640px] text-[15px] leading-relaxed text-[var(--text2)]">
            {description}
          </p>
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

        {/* items-start, or the columns stretch to each other's height and the
            shorter one's last card floats with dead space beneath it. Equal
            halves: the uneven 1fr/1.05fr split read as an alignment mistake at
            desktop widths, because it was one. */}
        <div className="mt-7 grid items-start gap-6 lg:grid-cols-2">
          {/* ── Left: the decision ─────────────────────────────────────── */}
          <div>
            {/* Two stats, side by side: what a unit costs, and what it returns.
                Both are withheld rather than estimated when any leg is unpriced
                — see blended_probability. */}
            {(basket.blended_probability !== null || basket.payout) && (
              <div className="grid grid-cols-2 gap-3">
                {basket.blended_probability !== null && (
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
                    <p className="font-mono text-[10px] tracking-[0.08em] text-[var(--faint)]">
                      {t.basket.blendedHeading}
                    </p>
                    <p className="ltr-num mt-2 text-[30px] leading-none font-extrabold text-[var(--up)]">
                      {pct(basket.blended_probability)}%
                    </p>
                  </div>
                )}
                {basket.payout?.multiple != null && (
                  <div
                    className="rounded-2xl border p-4"
                    style={{ borderColor: "var(--bk-goldborder)", background: "var(--bk-goldtint)" }}
                  >
                    <p className="font-mono text-[10px] tracking-[0.08em] text-[var(--faint)]">
                      {t.basket.bestCaseHeading}
                    </p>
                    <p
                      className="ltr-num mt-2 text-[30px] leading-none font-extrabold"
                      style={{ color: "var(--bk-gold)" }}
                    >
                      ×{basket.payout.multiple.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* What it pays if it comes good. Quoted per $100 because this page
                has no stake input; the app shows the real figure once a size is
                chosen. An exclusive basket gets the single-winner range instead
                of an "all hit" total, which for it is unreachable. */}
            {basket.payout && !isRecord && (
              <section className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
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
                {basket.payout.all_hit === null &&
                  evenPayout(basket.payout) === null &&
                  basket.payout.single_low < basket.payout.notional && (
                    <p className="mt-3 text-[13px] leading-relaxed text-[var(--mute)]">
                      {t.basket.payoutRangeWarn}
                    </p>
                  )}
              </section>
            )}

            {/* The record. This is what a shared link resolves to once the games
                have gone — previously the page 404'd here and took the results
                with it, which is precisely when someone follows the link. */}
            {isRecord && (
              <section className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
                <p className="font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]">
                  {t.basket.resultHeading}
                </p>
                <p className="ltr-num mt-2 text-[30px] leading-none font-extrabold">
                  {t.creatorProfile.hitOf
                    .replace("{won}", String(wonLegs))
                    .replace("{n}", String(decidedLegs.length))}
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--mute)]">
                  {decidedLegs.length === basket.legs.length
                    ? t.basket.settled
                    : t.basket.resultPending}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--mute)]">
                  {t.basket.resultClosed}
                </p>
              </section>
            )}

            {/* Stated beside the CTA, not buried in fine print: "buy several
                positions at once" reads as a parlay to anyone who has used a
                sportsbook, and that misreading changes what they think they
                bought. */}
            <p className="mt-3 rounded-2xl border border-[var(--line)] p-4 text-[13px] leading-relaxed text-[var(--text2)]">
              {t.basket.notParlay}
            </p>

            {!isRecord && (
              <BasketCtas
                slug={slug}
                tgBot={brand.tgBot}
                webLabel={t.basket.cta}
                tgLabel={t.basket.ctaTelegram}
              />
            )}

            <p className="mt-5 font-mono text-[11px] text-[var(--faint)]">
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
          </div>

          {/* ── Right: what is actually in it ──────────────────────────────
              One bordered card, not loose text: the left column opens with
              cards, and a column that opens with a bare heading starts at a
              different visual line — which is exactly the misalignment this
              layout got reported for. */}
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
            <h2 className="text-[17px] font-bold tracking-[-0.01em]">{t.basket.legsHeading}</h2>
            <p className="mt-2 text-[13px] text-[var(--mute)]">{t.basket.legsLead}</p>

            {/* Segmented weight bar: the split, before the list that explains
                it. Reading four percentages in a column does not show that one
                leg carries half the stake; this does. */}
            <div dir="ltr" className="mt-4 flex h-[10px] gap-[3px] overflow-hidden rounded-full">
              {basket.legs.map((leg, i) => (
                <div
                  key={leg.market.id}
                  style={{
                    flexGrow: leg.weight_pct,
                    flexBasis: 0,
                    background: LEG_COLORS[i % LEG_COLORS.length],
                  }}
                />
              ))}
            </div>

            <ul className="mt-4 space-y-2">
              {basket.legs.map((leg, i) => {
                const legTitle = localized(lang, leg.market.title, leg.market.title_fa);
                const state = legState(leg);
                return (
                  <li
                    key={leg.market.id}
                    className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--paper)]"
                  >
                    {/* Colour strip, width = weight. Ties each row to its
                        segment in the bar above without a legend. */}
                    <div
                      className="h-[3px]"
                      style={{
                        width: `${leg.weight_pct}%`,
                        background: LEG_COLORS[i % LEG_COLORS.length],
                      }}
                    />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          href={`/market/${leg.market.slug}`}
                          className="text-[14px] leading-snug font-semibold"
                        >
                          {legTitle}
                        </Link>
                        <span
                          className="ltr-num shrink-0 rounded-lg px-2 py-0.5 font-mono text-[12px] font-bold text-[var(--text2)]"
                          style={{ background: "var(--btn)" }}
                        >
                          {leg.weight_pct}%
                        </span>
                      </div>
                      <p
                        dir="ltr"
                        className="mt-2 flex flex-wrap items-center gap-x-2 font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]"
                        style={{ justifyContent: brand.dir === "rtl" ? "flex-end" : "flex-start" }}
                      >
                        <span
                          className="rounded-full px-1.5 py-0.5 font-bold"
                          style={{ background: "var(--bk-greenbg)", color: "var(--bk-green)" }}
                        >
                          {leg.side === "YES" ? t.series.resolvedYes : t.series.resolvedNo}
                        </span>
                        <span className="ltr-num">
                          {leg.price === null ? "—" : `${pct(leg.price)}%`}
                        </span>
                        {leg.market.close_time && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="ltr-num">
                              {deadlineDate(leg.market.close_time, lang)}
                            </span>
                          </>
                        )}
                        {/* The outcome, in the same colour language the creator
                            profile's track record already uses, so one basket
                            never reads two different ways in two places. */}
                        {isRecord && (
                          <>
                            <span aria-hidden>·</span>
                            <span
                              className="rounded-full px-1.5 py-0.5 font-bold"
                              style={{
                                background:
                                  state === "won"
                                    ? "var(--bk-greenbg)"
                                    : state === "lost"
                                      ? "rgba(224,112,90,0.14)"
                                      : "var(--chip, var(--line))",
                                color:
                                  state === "won"
                                    ? "var(--bk-green)"
                                    : state === "lost"
                                      ? "var(--down)"
                                      : "var(--mute)",
                              }}
                            >
                              {state === "won"
                                ? t.basket.legWon
                                : state === "lost"
                                  ? t.basket.legLost
                                  : state === "void"
                                    ? t.basket.legVoid
                                    : t.basket.legPending}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* The partial-fill contract, on the page rather than only in the
                bot: a reader deciding whether to buy should know before they tap
                that legs are independent orders. */}
            <p className="mt-4 text-[13px] leading-relaxed text-[var(--mute)]">
              {t.basket.partialNotice}
            </p>
          </section>
        </div>
      </article>
    </SiteChrome>
  );
}
