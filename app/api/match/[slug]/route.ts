import { NextResponse } from "next/server";
import { getEventBoardFresh, getWhalesForEvent } from "@/lib/api";

/**
 * Fresh headline odds + the whale strip for one match page.
 *
 * The match page itself is ISR'd for a day (every regeneration is a billed
 * write), so it renders with the day's snapshot and this refreshes the parts
 * that move, from the browser, every minute. Both upstream calls are cached
 * (60s / 300s) and the response is CDN-cached, so page traffic never reaches
 * Polymarket.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!/^[a-zA-Z0-9-]{1,200}$/.test(slug)) {
    return NextResponse.json({ error: "bad_slug" }, { status: 400 });
  }
  try {
    const [board, whales] = await Promise.all([getEventBoardFresh(slug), getWhalesForEvent(slug)]);
    if (!board) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(
      { result: board.result, status: board.event.status, live: board.live ?? null, as_of: board.as_of, whales },
      // 30s: the score is the part that moves (upstream caches it 20s).
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
    );
  } catch (e) {
    console.error("GET /api/match", e);
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
}
