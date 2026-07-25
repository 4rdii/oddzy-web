import { NextResponse } from "next/server";
import { getSections } from "@/lib/api";

/**
 * Two-level category tree for the markets chip rows.
 * Proxies the token-authenticated upstream so the browser never sees it.
 */
export async function GET() {
  try {
    const sections = await getSections();
    return NextResponse.json(
      { sections },
      { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } },
    );
  } catch (e) {
    console.error("GET /api/categories", e);
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
}
