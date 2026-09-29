import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { getBasket, getBaskets, getEvents, getHottest, getMarkets, getWhalesToday, type Market } from "@/lib/api";
import { HomePb, type HomeCat, type HomeHero, type HomeWhale } from "@/components/pb/HomePb";
import { HOME_FAQ } from "@/components/pb/homeFaq";
import { fixtureCard } from "@/components/pb/fixtures";
import { betLabel, enSideNames, sideNames, tierOf, whaleName } from "@/components/pb/whale";
import { fa, faDay, faMoney, faTime, nowMs, tehranDate } from "@/lib/pb";
import { getAllPosts } from "@/lib/posts";
import { compactUsd, localized, pct } from "@/lib/format";
import { brandFor, isLocale } from "@/lib/i18n";
import { getDict } from "@/lib/dict";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDict(lang);
  return {
    title: t.home.metaTitle,
    description: t.home.metaDescription,
    alternates: { canonical: "/" },
  };
}

export const revalidate = 300;

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang);
  const brand = brandFor(lang);

  if (lang === "fa") return <PolybaazHome />;

  const [hottest, snapshot, posts] = await Promise.all([
    getHottest().catch(() => null),
    getMarkets({ limit: 6 }).catch(() => ({ markets: [] as never[] })),
    getAllPosts(lang),
  ]);

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.name,
    url: brand.siteUrl,
    description: t.home.orgDescription,
    sameAs: [`https://t.me/${brand.tgBot}`],
  };

  return (
    <SiteChrome lang={lang}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      <section className="mx-auto max-w-5xl px-5 pt-16 pb-10">
        <p className="font-mono text-[11px] tracking-[0.1em] text-[var(--faint)]">
          {snapshot.markets.length > 0 ? t.home.pill : t.home.kicker}
        </p>
        <h1 className="mt-4 max-w-3xl text-[clamp(32px,6vw,56px)] leading-[1.05] font-bold tracking-[-0.03em]">
          {t.home.h1}
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[var(--text2)]">
          {t.home.lead}
        </p>

        {/* Trading on the web is now the primary path, so the primary CTA leads
            there. Telegram stays as the second button rather than disappearing:
            it is still where most existing users live. */}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/app"
            className="min-h-[50px] rounded-xl bg-[var(--ink)] px-6 py-3.5 font-semibold text-[var(--on-ink)]"
          >
            {t.cta.startTrading}
          </Link>
          <a
            href={`https://t.me/${brand.tgBot}`}
            className="min-h-[50px] rounded-xl border border-[var(--line)] bg-[var(--btn)] px-6 py-3.5 font-semibold text-[var(--ink)]"
          >
            {t.cta.openTelegram}
          </a>
        </div>
      </section>

      {/* Live ticker — real prices, the trust signal the plan asks for. */}
      {snapshot.markets.length > 0 && (
        <section className="mx-auto max-w-5xl px-5 py-6">
          <h2 className="font-mono text-[11px] tracking-[0.1em] text-[var(--faint)]">
            {t.home.tradingNow}
          </h2>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {snapshot.markets.slice(0, 6).map((m) => (
              <li key={m.id}>
                {/* Each row is the entry point to that market's own page: this
                    is the highest-volume set on the site, so leaving it as dead
                    text stranded the pages that most deserve internal links. */}
                <Link
                  href={`/market/${m.slug}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3.5"
                >
                  <span className="text-[14px] leading-snug font-medium">
                    {localized(lang, m.title, m.title_fa)}
                  </span>
                  <span className="shrink-0 text-end">
                    <span className="block font-mono text-[16px] font-bold text-[var(--up)]">
                      {pct(m.probability.yes)}%
                    </span>
                    <span className="block font-mono text-[10px] text-[var(--faint)]">
                      {compactUsd(m.volume.h24)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {hottest && (
            <p className="mt-4 font-mono text-[11px] text-[var(--faint)]">
              {t.home.busiest}:{" "}
              <Link href={`/market/${hottest.slug}`} className="underline">
                {localized(lang, hottest.title, hottest.title_fa)}
              </Link>{" "}
              · {compactUsd(hottest.volume.h24)} {t.home.in24h}
            </p>
          )}
        </section>
      )}

      {/* Baskets promo band. Plain links, no auth SDK — this page is the most
          crawled thing on the site and must stay cacheable HTML. */}
      <section className="mx-auto max-w-5xl px-5 py-8">
        <div
          className="rounded-2xl border p-6 sm:p-8"
          style={{ borderColor: "var(--bk-goldborder)", background: "var(--bk-goldtint)" }}
        >
          <h2 className="text-[24px] font-bold tracking-[-0.02em] text-[var(--ink)]">
            {t.home.basketsBandTitle}
          </h2>
          <p className="mt-2 max-w-[620px] text-[15px] leading-relaxed text-[var(--text2)]">
            {t.home.basketsBandBody}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href="/baskets"
              className="rounded-xl px-4 py-2.5 text-[14px] font-bold"
              style={{
                background: "var(--bk-cta)",
                color: "var(--bk-cta-ink)",
                boxShadow: "var(--bk-cta-shadow)",
              }}
            >
              {t.home.basketsBandCta}
            </Link>
            {/* The builder, not /basket: that path now redirects to /baskets,
                which is where the primary button already goes — two CTAs to one
                destination is one CTA and a decoy. */}
            <Link
              href="/baskets/new"
              className="text-[14px] font-semibold"
              style={{ color: "var(--bk-gold)" }}
            >
              {t.home.basketsBandSecondary}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-[28px] font-bold tracking-[-0.02em]">{t.home.howItWorks}</h2>
        <ol className="mt-7 grid gap-5 sm:grid-cols-3">
          {t.steps.map((s, i) => (
            <li key={s.t} className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
              <span className="font-mono text-[11px] tracking-[0.1em] text-[var(--accent)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 text-[17px] font-bold">{s.t}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--text2)]">{s.d}</p>
            </li>
          ))}
        </ol>
        <Link
          href="/how-it-works"
          className="mt-6 inline-block font-mono text-[12px] text-[var(--accent)]"
        >
          {t.home.readWalkthrough}
        </Link>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[28px] font-bold tracking-[-0.02em]">{t.home.learn}</h2>
          <Link href="/learn" className="font-mono text-[12px] text-[var(--accent)]">
            {t.home.allArticles}
          </Link>
        </div>
        <ul className="mt-7 grid gap-4 sm:grid-cols-2">
          {posts.slice(0, 4).map((p) => (
            <li key={p.slug}>
              <Link
                href={`/learn/${p.slug}`}
                className="block h-full rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 text-[var(--ink)]"
              >
                <span className="font-mono text-[10px] tracking-[0.1em] text-[var(--accent)]">
                  {p.tag}
                </span>
                <h3 className="mt-2 text-[17px] leading-snug font-bold">{p.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--text2)]">{p.lead}</p>
                <span className="mt-3 block font-mono text-[10px] tracking-[0.08em] text-[var(--faint)]">
                  {p.readingMinutes} {t.home.minRead}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </SiteChrome>
  );
}

/**
 * PolyBaaz home (design: PB Home). Every fetch here is at most the page's own
 * 300s window, so none of them can make the route regenerate faster.
 */
async function PolybaazHome() {
  const brand = brandFor("fa");
  const CATS: [string, string, string][] = [
    ["football", "فوتبال", "var(--gold)"],
    ["iran", "ایران", "var(--up)"],
    ["economy", "اقتصاد", "var(--blue)"],
    ["crypto", "کریپتو", "var(--home)"],
  ];
  const empty = { markets: [] as Market[] };
  const [events, whales, all, baskets, ...byCat] = await Promise.all([
    getEvents({ matchesOnly: true, mainOnly: true, includeClosing: true, limit: 150, revalidate: 300 }).catch(() => ({ events: [] })),
    getWhalesToday(300),
    getMarkets({ limit: 24, revalidate: 300 }).catch(() => empty),
    getBaskets().catch(() => []),
    ...CATS.map(([id]) => getMarkets({ category: id, limit: 12, revalidate: 300 }).catch(() => empty)),
  ]);

  // Hero: the biggest match that has not finished — today's first, else the next day's.
  const now = nowMs();
  // Kicked off at most 100 minutes ago (a match is ~2h with half-time): past
  // that it has probably ended, and a finished game must not headline the page.
  const live = events.events.filter((e) => e.starts_at && new Date(e.starts_at).getTime() > now - 100 * 60_000 && new Date(e.starts_at).getTime() < now + 36 * 3600_000);
  const pick = [...live].sort((a, b) => (b.volume_24h ?? 0) - (a.volume_24h ?? 0))[0] ?? null;
  let hero: HomeHero | null = null;
  if (pick) {
    const card = fixtureCard(pick, "");
    const wins = pick.main.filter((m) => m.kind === "moneyline");
    const draw = pick.main.find((m) => m.kind === "draw");
    const title = pick.title.toLowerCase();
    const at = (l: string | null | undefined) => {
      const i = title.indexOf(String(l ?? "").toLowerCase());
      return i < 0 ? 1e9 : i;
    };
    const [a, b] = [...wins].sort((x, y) => at(x.label) - at(y.label));
    if (card && a && b) {
      const today = tehranDate(new Date(now)) === tehranDate(pick.starts_at!);
      hero = {
        href: `/match/${pick.id}`,
        // "Other leagues › UEFA Nations League" → the league alone.
        league: pick.topic ? (pick.topic.name_fa ?? pick.topic.name).split("›").pop()!.trim() : "",
        when: `${today ? "امروز" : faDay(pick.starts_at!)} ${faTime(pick.starts_at!)} تهران`,
        home: { name: card.home, logo: card.homeLogo ?? null },
        away: { name: card.away, logo: card.awayLogo ?? null },
        sides: [
          { key: "home", label: `برد ${card.home}`, p: a.probability?.yes ?? null, slug: a.slug },
          ...(draw ? [{ key: "draw" as const, label: "مساوی", p: draw.probability?.yes ?? null, slug: draw.slug }] : []),
          { key: "away", label: `برد ${card.away}`, p: b.probability?.yes ?? null, slug: b.slug },
        ],
        vol: pick.volume_24h,
        marketCount: pick.market_count,
      };
    }
  }

  // Ticker + whales strip: real pre-match whale bets from today's big games.
  const bets = (whales?.games ?? []).flatMap((g) => g.whales.map((w) => ({ w, g, names: sideNames(g), en: enSideNames(g) })));
  bets.sort((x, y) => y.w.amount_usdc - x.w.amount_usdc);
  const ticks = bets.slice(0, 8).map(({ w, names, en }) => `${faMoney(w.amount_usdc)} روی «${betLabel(w, names, en)}» · ${whaleName(w)}`);
  const good = bets.find((x) => (x.w.stats?.score ?? 0) >= 60 && x.w.stats?.tier !== "new");
  const bad = bets.find((x) => x.w.stats && x.w.stats.score !== null && x.w.stats.score < 40);
  const homeWhales: HomeWhale[] = [bad, good]
    .filter((x): x is NonNullable<typeof x> => !!x)
    .map(({ w, names, en }) => {
      const t = tierOf(w.stats);
      return { name: whaleName(w), score: w.stats?.score ?? null, color: t.c, bet: `${betLabel(w, names, en)} در ${fa(Math.round(w.avg_price * 100))}٪ · ${t.label}`, amt: faMoney(w.amount_usdc) };
    });

  // A market at 0–3% or 97–100% is all but decided: its volume is people closing
  // out, not a question anyone should be invited to answer.
  const open = (m: Market) => m.probability && m.probability.yes > 0.03 && m.probability.yes < 0.97;
  const toCard = (m: Market) => ({
    slug: m.slug,
    href: `/market/${m.slug}`,
    q: localized("fa", m.title, m.title_fa),
    p: m.probability?.yes ?? null,
    vol: m.volume?.h24 ?? 0,
  });
  const cats: HomeCat[] = [
    { key: "all", label: "همه", color: "var(--gold)", markets: all.markets.filter(open).map(toCard) },
    ...CATS.map(([key, label, color], i) => ({ key, label, color, markets: byCat[i].markets.filter(open).map(toCard) })).filter((c) => c.markets.length > 0),
  ].filter((c) => c.markets.length > 0);

  // Baskets tile: the most-bought active curated basket.
  const top = [...baskets].filter((x) => x.status === "active" && x.curated).sort((a, b) => b.stats.buys - a.stats.buys)[0];
  const detail = top ? await getBasket(top.slug).catch(() => null) : null;
  const basket = detail
    ? {
        href: `/baskets/${detail.slug}`,
        title: localized("fa", detail.title, detail.title_fa),
        legs: [...detail.legs]
          .sort((a, b) => b.weight_pct - a.weight_pct)
          .slice(0, 3)
          .map((l) => ({ label: localized("fa", l.market.title, l.market.title_fa), pct: Math.round(l.weight_pct) })),
        mult: detail.payout?.single_multiple ?? detail.payout?.multiple ?? null,
      }
    : null;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: brand.name,
      url: brand.siteUrl,
      description: getDict("fa").home.orgDescription,
      sameAs: [`https://t.me/${brand.tgBot}`],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: HOME_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <SiteChrome lang="fa">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HomePb hero={hero} ticks={ticks} cats={cats} whales={homeWhales} basket={basket} />
    </SiteChrome>
  );
}
