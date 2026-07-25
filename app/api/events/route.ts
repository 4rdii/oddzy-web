import { NextResponse, type NextRequest } from "next/server";
import { getEvents } from "@/lib/api";

/** GET /api/events?category=&limit= — event-grouped feed for the games view. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = sp.get("category") ?? undefined;
  const raw = Number(sp.get("limit") ?? 20);
  const limit = Number.isFinite(raw) ? Math.min(Math.max(1, raw), 50) : 20;

  try {
    const data = await getEvents({ category, limit });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" },
    });
  } catch (e) {
    console.error("GET /api/events", e);
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
}
