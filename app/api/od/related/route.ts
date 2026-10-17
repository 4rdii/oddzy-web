import { NextResponse, type NextRequest } from "next/server";
import { getDesk } from "@/lib/api";
import { indexDesk, mini, newsItems } from "@/lib/desk";
import { nowMs } from "@/lib/pb";

/**
 * A question page's live sidebar data: its countries, today's stories that
 * link to it (or its family), and related questions. Fetched by the browser
 * because market pages are ISR'd for a day (see app/[lang]/market/[slug]) and
 * a 5-minute /desk fetch inside them would pull that window down to minutes.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const desk = await getDesk(300);
  if (!desk) return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  const ix = indexDesk(desk);
  const m = desk.markets.find((x) => x.slug === slug);
  const headers = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" };
  if (!m) return NextResponse.json({ countries: [], news: [], related: [], sec: null, sub: null }, { headers });

  const fam = m.fam ? desk.families.find((f) => f.key === m.fam) : null;
  const famIds = new Set(fam?.m ?? [m.id]);
  const cname = new Map(desk.countries.map((c) => [c.iso2, c.en]));
  const news = newsItems(ix, nowMs(), (n) => n.marketIds.some((id) => famIds.has(id) || id === m.id)).slice(0, 4);
  const sameSub = desk.markets.filter((x) => x.id !== m.id && !famIds.has(x.id) && x.sub === m.sub);
  const shared = desk.markets.filter((x) => x.id !== m.id && !famIds.has(x.id) && x.sub !== m.sub && x.countryIds.some((c) => m.countryIds.includes(c)));
  const seen = new Set<string>();
  const related = [...sameSub.sort((a, b) => b.vol24h - a.vol24h), ...shared.sort((a, b) => b.vol24h - a.vol24h)]
    .filter((x) => !seen.has(x.id) && seen.add(x.id))
    .slice(0, 6)
    .map(mini);
  return NextResponse.json(
    {
      countries: m.iso2.map((code) => ({ code, name: cname.get(code) ?? code })),
      news: news.map((n) => ({ k: n.k, q: n.q, s: n.s, src: n.src, ago: n.ago, url: n.url })),
      related,
      sec: m.sec,
      sub: { slug: m.sub, name: ix.subName(m.sub) },
    },
    { headers },
  );
}
