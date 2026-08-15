import { NextResponse } from "next/server";
import { getUpDownWindows } from "@/lib/api";

/**
 * Live 15-minute crypto up/down windows.
 * Proxies the token-authenticated upstream so the browser never sees it.
 *
 * `no-store`, unlike every other route in this directory. Those describe things
 * that move over hours and cache happily; a window here lives fifteen minutes,
 * so a cached response is not merely stale, it can advertise a market that has
 * already expired and a price nobody can fill at. The client polls this on a
 * few-second cadence while the countdown runs.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { windows, settled } = await getUpDownWindows();
    return NextResponse.json(
      { windows, settled },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("GET /api/updown", e);
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
}
