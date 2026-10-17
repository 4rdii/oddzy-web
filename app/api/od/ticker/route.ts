import { NextResponse } from "next/server";
import { getDesk } from "@/lib/api";
import { chg, clip, fmtV, marketUrl, pct, type OdTick } from "@/lib/od";

/**
 * The oddzy.xyz header wire: the day's biggest movers across the three desks.
 *
 * Fetched by the browser rather than rendered into the header, because the
 * header is on every page and a 5-minute fetch there would pull every page's
 * ISR window down to 5 minutes (see the note on getMarkets in lib/api.ts).
 * CDN-cached for the same 5 minutes as the upstream.
 */
export async function GET() {
  const desk = await getDesk(300);
  if (!desk) return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  const ticks: OdTick[] = [...desk.markets]
    .filter((m) => m.chg !== null && Math.round(m.chg) !== 0 && m.vol24h >= 5_000)
    .sort((a, b) => Math.abs(b.chg ?? 0) - Math.abs(a.chg ?? 0))
    .slice(0, 14)
    .map((m) => ({
      url: marketUrl(m.slug),
      codes: m.iso2.slice(0, 2).join("·"),
      short: clip(m.title, 44),
      p: pct(m.yes),
      chg: chg(m.chg),
      up: (m.chg ?? 0) > 0,
    }));
  return NextResponse.json(
    { ticks, traded: fmtV(desk.totals.vol24h) },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
