import { NextResponse, type NextRequest } from "next/server";
import { getMarkets } from "@/lib/api";

const MAX_LIMIT = 100;

/**
 * Market feed for the mini-app screens.
 * GET /api/markets?category=<leafId>&limit=&offset=
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = sp.get("category") ?? undefined;

  // Clamp pagination: these land straight in an upstream query string, and an
  // unbounded limit would let a caller pull the whole snapshot in one request.
  const rawLimit = Number(sp.get("limit") ?? 30);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), MAX_LIMIT) : 30;
  const rawOffset = Number(sp.get("offset") ?? 0);
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;

  try {
    const snap = await getMarkets({ category, limit, offset });
    return NextResponse.json(snap, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" },
    });
  } catch (e) {
    console.error("GET /api/markets", e);
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
}
