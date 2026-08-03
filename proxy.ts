import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LOCALES, localeForHost } from "@/lib/i18n";

/**
 * Host -> locale segment, as an internal rewrite.
 *
 * `oddzy.xyz/faq`    -> renders `app/[lang]/faq` with lang=en
 * `polybaaz.com/faq` -> renders `app/[lang]/faq` with lang=fa
 *
 * A rewrite (not a redirect) keeps `/fa` out of the address bar — each brand
 * owns its whole hostname and the locale is never user-visible.
 *
 * Why route on the path at all, rather than reading the Host header inside the
 * layout: the marketing page and the app shell are ISR (`revalidate = 300`) and
 * both hostnames are served by ONE Vercel deployment sharing ONE cache. Keying
 * the render on a header would leave both brands sharing a cache entry, so
 * whichever brand populated it first would be served to the other. The rewritten
 * path is part of the cache key, which keeps the two brands separate and lets
 * both stay statically rendered.
 *
 * NOTE (Next 16): this file is `proxy.ts`, not `middleware.ts` — Middleware was
 * renamed to Proxy. A `middleware.ts` here would be silently ignored.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Already locale-prefixed (direct hit / internal rewrite loop guard).
  if (LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) {
    return NextResponse.next();
  }

  const locale = localeForHost(request.headers.get("host"));
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;

  const res = NextResponse.rewrite(url);
  // Lets route handlers and any dynamic render below know the resolved brand
  // without re-parsing the host.
  res.headers.set("x-locale", locale);
  return res;
}

export const config = {
  matcher: [
    /**
     * Everything except:
     *  - /api/*        route handlers are shared by both brands, not localized
     *  - /_next/*      framework assets
     *  - /sitemap.xml, /robots.txt  per-host SEO files, served unprefixed
     *  - any path with a file extension (favicon.ico, og images, fonts)
     */
    "/((?!api|_next|sitemap\\.xml|robots\\.txt|.*\\.[\\w]+$).*)",
  ],
};
