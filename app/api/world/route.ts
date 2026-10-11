import { NextResponse } from "next/server";
import { getWorld } from "@/lib/api";
import { toWorldView } from "@/lib/world";

/**
 * The world map's 60s client refresh (the page itself is ISR'd for longer).
 * Returns the same view model the page rendered, already formatted, so the
 * client swaps it in without recomputing anything. The upstream fetch is
 * cached 60s and the response is CDN-cached for the same, so page traffic
 * never multiplies into API calls.
 */
export async function GET() {
  const world = await getWorld(60);
  if (!world) return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  return NextResponse.json(toWorldView(world), {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
