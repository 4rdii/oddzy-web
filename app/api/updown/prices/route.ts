import { NextResponse } from "next/server";
import { getUpDownPrices } from "@/lib/api";

/**
 * Price history for one up/down window.
 *
 * A thin proxy over our own API, which is where the Binance call actually
 * happens. That indirection is not incidental: Binance geo-blocks Iranian IPs
 * (so this cannot be a browser fetch — Iranian readers are most of PolyBaaz's
 * audience) AND returns 451 to US IPs (so it cannot run in this function's
 * default region either). The VPS is neither, and is the only place in the stack
 * that can see the data.
 *
 * WHY THIS EXISTS: the odds sparkline shows what the market thinks but not why.
 * These resolve on whether the AVERAGE price across the window ends at or above
 * the price when it opened, which is only legible with the price, the anchor and
 * the running average shown together.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  if (!/^[a-z]+-updown-15m-\d+$/.test(slug)) {
    return NextResponse.json({ error: "bad_slug" }, { status: 400 });
  }
  const data = await getUpDownPrices(slug);
  if (!data) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
  return NextResponse.json(data, {
    headers: {
      // A finished window is immutable; a live one gains a bar every second.
      "Cache-Control": data.complete
        ? "public, s-maxage=3600, stale-while-revalidate=86400"
        : "public, s-maxage=5",
    },
  });
}
