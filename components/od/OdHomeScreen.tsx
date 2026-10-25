import { SiteChrome } from "@/components/site/Chrome";
import { getDesk } from "@/lib/api";
import { finderRows, globeCountries, indexDesk, mini, newsItems, osintPins, pickLead } from "@/lib/desk";
import { nowMs } from "@/lib/pb";
import { fmtV, marketUrl, topicUrl } from "@/lib/od";
import { OdHome, type DeskCard } from "./OdHome";

/**
 * oddzy.xyz home (design: "Oddzy Home"). Server-renders everything a crawler
 * needs — lead story, movers, the wire, the ranked countries, the desks —
 * and hands OdHome only the slices it shows.
 *
 * `revalidate` is the page's ISR window; the /desk fetch must not be shorter.
 */
export async function OdHomeScreen({ revalidate }: { revalidate: number }) {
  const desk = await getDesk(revalidate);
  const now = nowMs();
  if (!desk) {
    return (
      <SiteChrome lang="en" od="home">
        <div className="od-main" style={{ padding: "80px 0", color: "var(--od-ink3)" }}>
          The markets are taking a moment to load. Try again in a minute.
        </div>
      </SiteChrome>
    );
  }
  const ix = indexDesk(desk);
  const lead = pickLead(ix, now);
  const countries = globeCountries(ix);
  const news = newsItems(ix, now);
  const pins = osintPins(ix, now);
  const movers = [...desk.markets]
    .filter((m) => m.chg !== null && m.vol24h >= 10_000)
    .sort((a, b) => Math.abs(b.chg ?? 0) - Math.abs(a.chg ?? 0))
    .slice(0, 7)
    .map(mini);
  const desks: DeskCard[] = (["pol", "eco", "war"] as const).map((k) => {
    const s = desk.sections.find((x) => x.key === k)!;
    const top = desk.markets
      .filter((m) => m.sec === k)
      .sort((a, b) => b.vol24h - a.vol24h)
      .slice(0, 2);
    return { key: k, name: s.name, url: topicUrl(s.slug), count: s.markets, vol: s.vol24h, top: top.map((m) => ({ q: m.title, p: m.yes, url: marketUrl(m.slug) })) };
  });
  const dateLine = new Date(now).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).replace(/,/g, "");

  const site = "https://oddzy.xyz";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Hottest countries on prediction markets",
    numberOfItems: Math.min(10, countries.length),
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: [...countries]
      .sort((a, b) => b.v - a.v)
      .slice(0, 10)
      .map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, ...(c.url ? { url: `${site}${c.url}` } : {}) })),
  };

  return (
    <SiteChrome lang="en" od="home">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <OdHome
        renderedAt={now}
        dateLine={dateLine}
        totals={{ vol: fmtV(desk.totals.vol24h), countries: desk.totals.countries, markets: desk.totals.markets.toLocaleString("en-US") }}
        lead={lead}
        countries={countries}
        news={news}
        pins={pins}
        movers={movers}
        desks={desks}
        finder={finderRows(ix)}
      />
    </SiteChrome>
  );
}
