import { NextResponse } from "next/server";
import { getTopics } from "@/lib/api";

/**
 * Navigation tree for the markets drill-down.
 * Proxies the token-authenticated upstream so the browser never sees it.
 */
export async function GET() {
  try {
    const topics = await getTopics();
    return NextResponse.json(
      { topics },
      { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } },
    );
  } catch (e) {
    console.error("GET /api/categories", e);
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
}
