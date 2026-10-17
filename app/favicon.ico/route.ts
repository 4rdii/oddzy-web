import { NextResponse, type NextRequest } from "next/server";
import { localeForHost } from "@/lib/i18n";

/**
 * Browsers and crawlers still ask for /favicon.ico directly. Both sites share
 * one deployment, so a static file would give them the same icon: send each
 * host to its own brand icon instead.
 */
export function GET(req: NextRequest) {
  const lang = localeForHost(req.headers.get("host"));
  return NextResponse.redirect(new URL(`/brand/${lang}/icon-32.png`, req.url), {
    status: 308,
    headers: { "cache-control": "public, max-age=86400" },
  });
}
