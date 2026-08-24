import { NextResponse } from "next/server";
import { getMarketDetail } from "@/lib/api";

/**
 * One market, by slug — the lookup behind the `/app?market=<slug>` deep link.
 *
 * Backed by `getMarketDetail`, which is the same upstream call the market page
 * itself makes, so anything with a public page can be opened in the app.
 *
 * Deliberately NOT `findMarketBySlug`: that helper only scans the top 200
 * markets by volume and returns null for everything below the cut, which is
 * most of them. It would have made this endpoint work in testing on the busiest
 * markets and fail silently on the long tail.
 *
 * Only `market` is returned — the caller needs the object to seed a detail
 * screen, and the price history is fetched by that screen when it mounts.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!/^[a-zA-Z0-9-]{1,200}$/.test(slug)) {
    return NextResponse.json({ error: "bad_slug" }, { status: 400 });
  }
  try {
    const detail = await getMarketDetail(slug);
    if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(detail.market, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" },
    });
  } catch (e) {
    console.error("GET /api/markets/by-slug", e);
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
}
