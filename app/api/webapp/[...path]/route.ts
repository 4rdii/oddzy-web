import { NextResponse, type NextRequest } from "next/server";

/**
 * Same-origin proxy for the bot's authenticated API.
 *
 * The browser used to call app.oddzy.xyz directly, which meant a user had to
 * reach TWO hosts: Vercel for the app, and the VPS for anything requiring an
 * account. Networks that can do the first but not the second — flaky proxies and
 * VPNs, the normal condition for our Iranian users — got a site that browsed
 * perfectly and then failed the instant they tried to sign in or bet. That is
 * the worst failure shape available: it looks like our bug, not their network.
 *
 * Now the browser only ever talks to oddzy.xyz, and Vercel reaches the VPS
 * server-to-server over a connection the user's network has no say in.
 *
 * What this does NOT touch is Privy. The Privy SDK still talks to auth.privy.io
 * straight from the browser for login, and Privy's allowed-origins check still
 * sees oddzy.xyz, which is allowlisted. We only carry the resulting access token
 * through as an opaque bearer string; it is verified against Privy's JWKS by the
 * bot, server-side, as it always was. Nothing here changes who Privy will let in.
 */

const UPSTREAM = process.env.API_ORIGIN ?? "https://app.oddzy.xyz";

/** Only these headers cross to the upstream. Cookies deliberately do not. */
const FORWARD_REQUEST_HEADERS = ["authorization", "x-telegram-init-data", "content-type"];

/**
 * Placing a bet waits on Polymarket's CLOB and the chain, which is slower than a
 * default serverless timeout allows for.
 */
export const maxDuration = 60;
// Auth-scoped responses carry per-user balances and positions; never cache them,
// at any layer.
export const dynamic = "force-dynamic";

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  // Rebuild the upstream path from the catch-all. The client calls
  // /api/webapp/v1/me, so `path` is already ["v1","me"] — the version belongs to
  // the caller's path, not to this prefix. The bot mounts these under /webapp,
  // NOT /api: Traefik routes /api on app.oddzy.xyz to the content-API container.
  // See apps/bot/src/api/v1.ts.
  const target = `${UPSTREAM}/webapp/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      // GET/HEAD must not carry one, and Node throws rather than ignoring it.
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
      cache: "no-store",
      redirect: "manual",
    });
  } catch (e) {
    console.error(`[webapp-proxy] ${req.method} ${path.join("/")} failed:`, e);
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  // Pass the body and status through untouched. The client maps 401/404/409/429
  // to distinct states, so collapsing them here would break the UI's ability to
  // tell "not signed in" from "no account yet" from "already linked".
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}
