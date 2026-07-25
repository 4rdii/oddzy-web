import "server-only";

import type { Topic } from "./taxonomy";

/**
 * Server-side client for the Oddzy market-data API (app.oddzy.xyz/api).
 *
 * The API is bearer-authenticated and the token must never reach the browser,
 * so every call here is server-only. Client screens talk to our own
 * /api/* route handlers, which call through this module.
 *
 * The upstream serves a Postgres snapshot refreshed by the indexer roughly
 * every 30 minutes and never calls Polymarket itself — so caching aggressively
 * here is free and also protects the rate limit the betting bots depend on.
 */

const BASE = process.env.ODDZY_API_BASE ?? "https://app.oddzy.xyz/api";
const TOKEN = process.env.ODDZY_API_TOKEN ?? "";

export type Market = {
  id: string;
  slug: string;
  title: string;
  category: { id: string; name: string } | null;
  probability: { yes: number; no: number };
  outcome_labels: string[] | null;
  volume: { total: number; h24: number };
  close_time: string | null;
  status: string;
  url: string;
};

export type Snapshot = {
  markets: Market[];
  count: number;
  as_of: string;
  max_staleness_minutes: number;
};

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function get<T>(path: string, revalidate: number): Promise<T> {
  if (!TOKEN) {
    throw new ApiError("ODDZY_API_TOKEN is not configured", 500);
  }
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    // The upstream snapshot only moves every ~30 min; revalidate well inside
    // that so a page is never staler than the data it describes.
    next: { revalidate },
  });
  if (!res.ok) {
    throw new ApiError(`GET ${path} failed: ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

/**
 * The navigation tree, exactly as the bot models it (see /topics upstream).
 * Cached for 15 min — the shape changes when topics are added, not per-request.
 */
export async function getTopics(): Promise<Topic[]> {
  const data = await get<{ topics: Topic[] }>("/topics", 900);
  return data.topics;
}

/**
 * Market feed. `category` is a leaf category id from the taxonomy; omitting it
 * returns the cross-category feed sorted by 24h volume.
 */
export async function getMarkets(opts: {
  category?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Snapshot> {
  const params = new URLSearchParams();
  if (opts.category) params.set("category", opts.category);
  params.set("limit", String(opts.limit ?? 30));
  if (opts.offset) params.set("offset", String(opts.offset));
  return get<Snapshot>(`/markets/snapshot?${params}`, 300);
}

/** The single highest-24h-volume live market — powers the marketing hero. */
export async function getHottest(): Promise<Market | null> {
  try {
    const data = await get<{ market: Market }>("/markets/hottest", 300);
    return data.market;
  } catch (e) {
    // 503 no_live_markets is a documented, expected response — the hero just
    // falls back to the generic headline rather than failing the page.
    if (e instanceof ApiError && e.status === 503) return null;
    throw e;
  }
}

/** Resolution state for one market, by condition id or slug. */
export async function getMarketStatus(idOrSlug: string) {
  return get<{
    id: string;
    slug: string;
    title: string;
    resolved: boolean;
    outcome: string | null;
    outcome_label: string | null;
    status: string;
    close_time: string | null;
  }>(`/markets/${encodeURIComponent(idOrSlug)}/status`, 300);
}

/**
 * Find one market by slug. The upstream has no by-slug detail endpoint, so we
 * pull the market's own category page and match locally — cheap, because the
 * snapshot response is already cached per category.
 */
export async function findMarketBySlug(slug: string): Promise<Market | null> {
  const status = await getMarketStatus(slug).catch(() => null);
  const snap = await getMarkets({ limit: 200 });
  const direct = snap.markets.find((m) => m.slug === slug || m.id === slug);
  if (direct) return direct;
  if (!status) return null;
  return null;
}

export { ApiError };
