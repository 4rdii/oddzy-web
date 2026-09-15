import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isLocale, type Locale } from "@/lib/i18n";
import { cleanText, findMatches, type Match } from "@/lib/market-finder";

/**
 * POST /api/extension/match — the Market Finder extension's only backend call.
 * Body: { text: string, lang?: "en" | "fa" }  ->  { matches: Match[] }
 *
 * Read-only market discovery; nothing here touches baskets, trading or auth.
 *
 * Every call spends LLM router credits, so this route must not become a free
 * public proxy. The guards, in order:
 *  - CORS limited to extension origins (EXTENSION_ALLOWED_ORIGINS when set).
 *    This only restrains browsers — a script ignores CORS entirely.
 *  - x-extension-key must equal EXTENSION_CLIENT_KEY. It ships inside the
 *    extension bundle, so it is extractable: it stops drive-by callers, not a
 *    determined one.
 *  - A per-IP rate limit and a response cache. Both are in-memory and so
 *    per serverless instance — approximate, not a hard cap. If this gets
 *    abused, move the counter to a shared store (Upstash Redis).
 */

export const maxDuration = 30;

const CLIENT_KEY = process.env.EXTENSION_CLIENT_KEY ?? "";
const ALLOWED_ORIGINS = (process.env.EXTENSION_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const MIN_TEXT_CHARS = 20;
const RATE_WINDOW_MS = 60_000;
const RATE_PER_WINDOW = 8;
const RATE_DAY_MS = 86_400_000;
const RATE_PER_DAY = 150;
const CACHE_TTL_MS = 30 * 60_000;
const CACHE_MAX = 500;

type Hits = { minute: number[]; dayStart: number; day: number };
const hitsByIp = new Map<string, Hits>();
const cache = new Map<string, { at: number; matches: Match[] }>();

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin !== null &&
    (ALLOWED_ORIGINS.length > 0
      ? ALLOWED_ORIGINS.includes(origin)
      : origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://"));
  if (!allowed) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Extension-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null, extra: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...corsHeaders(origin), "Cache-Control": "no-store", ...extra },
  });
}

function keyOk(sent: string | null): boolean {
  if (!CLIENT_KEY) return true;
  if (!sent) return false;
  const a = Buffer.from(sent);
  const b = Buffer.from(CLIENT_KEY);
  return a.length === b.length && timingSafeEqual(a, b);
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Returns the seconds to wait when over the limit, or 0 to proceed. */
function rateLimited(ip: string, now: number): number {
  let h = hitsByIp.get(ip);
  if (!h) {
    h = { minute: [], dayStart: now, day: 0 };
    hitsByIp.set(ip, h);
  }
  if (now - h.dayStart > RATE_DAY_MS) {
    h.dayStart = now;
    h.day = 0;
  }
  h.minute = h.minute.filter((t) => now - t < RATE_WINDOW_MS);
  if (h.day >= RATE_PER_DAY) return Math.ceil((h.dayStart + RATE_DAY_MS - now) / 1000);
  if (h.minute.length >= RATE_PER_WINDOW) return Math.ceil((h.minute[0] + RATE_WINDOW_MS - now) / 1000);
  h.minute.push(now);
  h.day++;
  // Keep the map from growing without bound on a long-lived instance.
  if (hitsByIp.size > 10_000) hitsByIp.clear();
  return 0;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  if (!keyOk(req.headers.get("x-extension-key"))) {
    return json({ error: "unauthorized" }, 401, origin);
  }

  let body: { text?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400, origin);
  }
  const text = typeof body.text === "string" ? cleanText(body.text) : "";
  if (text.length < MIN_TEXT_CHARS) return json({ error: "text_too_short" }, 400, origin);
  const lang: Locale = typeof body.lang === "string" && isLocale(body.lang) ? body.lang : "en";

  const now = Date.now();
  const cacheKey = createHash("sha256").update(`${lang}\n${text}`).digest("hex");
  const hit = cache.get(cacheKey);
  if (hit && now - hit.at < CACHE_TTL_MS) return json({ matches: hit.matches }, 200, origin);

  const wait = rateLimited(clientIp(req), now);
  if (wait > 0) return json({ error: "rate_limited" }, 429, origin, { "Retry-After": String(wait) });

  try {
    const started = Date.now();
    const { matches, keywords } = await findMatches(text, lang);
    console.log(
      `extension/match lang=${lang} chars=${text.length} keywords=${JSON.stringify(keywords)} matches=${matches.length} ms=${Date.now() - started}`,
    );
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, { at: now, matches });
    return json({ matches }, 200, origin);
  } catch (e) {
    console.error("POST /api/extension/match", e);
    return json({ error: "match_unavailable" }, 502, origin);
  }
}
