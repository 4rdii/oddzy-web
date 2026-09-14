import { NextResponse } from "next/server";
import { getUpDownWindows } from "@/lib/api";

/**
 * Live 15-minute crypto up/down windows.
 * Proxies the token-authenticated upstream so the browser never sees it.
 *
 * Cached for TWO SECONDS at the edge, which is the whole point of this route.
 * Every open desk polls it every 5s, so without a shared cache the cost is
 * linear in concurrent viewers: one function invocation per viewer per 5s,
 * forever, all returning the identical 5KB body. With s-maxage the entire
 * audience collapses onto ~one origin call every 3s no matter how many people
 * are watching. That was 75% of a month's Fluid Active CPU budget.
 *
 * Three seconds is safe on a fifteen-minute instrument, and the risk the old
 * comment worried about — advertising a window that has already expired — was
 * never carried by this response anyway. The board recomputes every countdown
 * from the window timestamps against a client clock that ticks once a second
 * (see UpDownBoard), so an expired window disappears locally whether or not the
 * poll behind it was fresh. What staleness delays is a NEW window appearing, by
 * at most s-maxage + swr.
 */
// Still rendered per request (the upstream call must happen server-side, where
// the API token lives); `dynamic` governs the render, Cache-Control governs the
// CDN, and only the second one is what saves the money here.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 2s, matching the edge cache below — the two together mean a burst of
    // polls costs one upstream call, not one per invocation that slips through.
    const { windows, settled } = await getUpDownWindows(0, 2);
    return NextResponse.json(
      { windows, settled },
      {
        headers: {
          /*
           * No stale-while-revalidate. With swr=12 on top of s-maxage=3, every
           * poll measured on 2026-09-14 came back `x-vercel-cache: STALE` about
           * 10s old: under steady polling the edge always has a stale copy to
           * hand out, so the fresh one only ever reaches the NEXT viewer. Prices
           * upstream now move every 3s (read from the CLOB book), so that
           * staleness was the largest delay left. Without swr a request at
           * expiry waits one origin round trip instead — tens of milliseconds.
           */
          "Cache-Control": "public, s-maxage=2",
        },
      },
    );
  } catch (e) {
    console.error("GET /api/updown", e);
    // Never let a blip get pinned to the edge for even three seconds: a cached
    // 502 would blank every desk on the next poll, not just the one that lost.
    return NextResponse.json(
      { error: "upstream_unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
