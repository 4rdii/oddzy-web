import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { getBasket, getBaskets, getEvents, getMarkets, getWhalesToday, type Market } from "@/lib/api";
import { HomePb, type HomeCat, type HomeHero, type HomeWhale } from "@/components/pb/HomePb";
import { HOME_FAQ } from "@/components/pb/homeFaq";
import { fixtureCard } from "@/components/pb/fixtures";
import { betLabel, enSideNames, sideNames, tierOf, whaleName } from "@/components/pb/whale";
import { fa, faDay, faMoney, faTime, nowMs, tehranDate } from "@/lib/pb";
import { localized } from "@/lib/format";
import { brandFor, isLocale } from "@/lib/i18n";
import { getDict } from "@/lib/dict";
import { WorldScreen } from "./world/WorldScreen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDict(lang);
  if (lang === "en") {
    // Oddzy's home is the world map: politics, war and economy markets.
    return {
      title: { absolute: t.world.metaTitle },
      description: t.world.metaDescription,
      alternates: { canonical: "/" },
      openGraph: { title: t.world.metaTitle, description: t.world.metaDescription, url: "/" },
    };
  }
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

  if (lang === "fa") return <PolybaazHome />;

  // Oddzy opens on the world map (PolyBaaz keeps it at /world).
  const brand = brandFor(lang);
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.name,
    url: brand.siteUrl,
    description: getDict(lang).home.orgDescription,
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      <WorldScreen lang={lang} revalidate={revalidate} />
    </>
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
