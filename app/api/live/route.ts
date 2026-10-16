import { NextResponse } from "next/server";
import { getLive } from "@/lib/api";

/**
 * «زنده»'s 15s client refresh (the page itself is ISR'd for longer). The
 * upstream fetch is cached 15s and the response is CDN-cached for the same,
 * so page traffic never multiplies into API calls (upstream caches the whole
 * board 15s too, and each game's live feed 20s).
 */
export async function GET() {
  const board = await getLive(15);
  if (!board) return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  return NextResponse.json(board, {
    headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" },
  });
}
