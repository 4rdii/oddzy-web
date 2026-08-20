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
  /**
   * Persian title, filled by the bot's translation worker. Null means "not
   * translated yet", which is common for markets that were only just ingested —
   * always read it through `localized()` so the English title covers the gap.
   */
  title_fa: string | null;
  /**
   * Polymarket's own resolution rules, verbatim and untranslated. Plain text
   * that may contain newlines; render it as text, never as markup — it is
   * creator-authored and reaches us unescaped.
   */
  description: string | null;
  /** Persian rendering of the same rules; null until translated. */
  description_fa: string | null;
  category: { id: string; name: string; name_fa: string | null } | null;
  probability: { yes: number; no: number };
  outcome_labels: { yes: string | null; no: string | null; yes_fa: string | null; no_fa: string | null } | null;
  volume: { total: number; h24: number };
  close_time: string | null;
  status: string;
  /** "YES" / "NO" once settled, null while live. */
  outcome: string | null;
  url: string;
};

/** A market as it appears inside an event group (carries its kind). */
export type EventMarket = Market & { kind: string | null };

/**
 * Markets grouped by their event, the way the bot renders a fixture:
 * name + kick-off, the moneyline, then the derivative markets beneath.
 */
export type MarketEvent = {
  id: string;
  short_id: string;
  title: string;
  /** Persian event title; null until translated. See `localized()`. */
  title_fa: string | null;
  kind: "match" | "multi_winner" | "binary";
  starts_at: string | null;
  topic: { id: string; name: string; name_fa: string | null } | null;
  market_count: number;
  volume_24h: number;
  /** Moneyline + draw for a match; the outcome list for a multi-winner. */
  main: EventMarket[];
  /** Totals, spreads, BTTS, h2h — the "extra markets" tier. */
  extra: EventMarket[];
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
 * Cache window for the per-entity detail calls that back a prerendered page.
 *
 * One number because it is really one budget. Each of ~500 markets, 58 question
 * families and 11 baskets is prerendered in BOTH locales, so these three calls
 * stand behind ~1200 ISR pages — and an ISR write is billed every time one of
 * them regenerates, whether or not the odds actually moved. At the old 600s a
 * page needed traffic in only a fraction of its 10-minute windows to blow a
 * 200k/month quota; an hour makes the same traffic cost a sixth as much.
 *
 * An hour is also honest about the data: the upstream snapshot moves every ~30
 * min, so a market page was never fresher than this, it was just rebuilt more
 * often. The live, second-by-second numbers live in the mini-app, which is not
 * ISR at all.
 */
const DETAIL_TTL = 3600;

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
  /**
   * Cache window, seconds. Default 300, for the surfaces a person watches (the
   * hero feed, the app shell). Pass a longer one from a PRERENDERED page: a
   * route's revalidation period is the LOWEST revalidate of any fetch inside
   * it, so a 300s call here silently overrides that page's `export const
   * revalidate` and doubles or sextuples its ISR writes. See the note on
   * `revalidate` in app/[lang]/topic/[slug]/page.tsx.
   */
  revalidate?: number;
} = {}): Promise<Snapshot> {
  const params = new URLSearchParams();
  if (opts.category) params.set("category", opts.category);
  params.set("limit", String(opts.limit ?? 30));
  if (opts.offset) params.set("offset", String(opts.offset));
  return get<Snapshot>(`/markets/snapshot?${params}`, opts.revalidate ?? 300);
}

/**
 * Event-grouped feed. Matches sort by kick-off, everything else by volume.
 * `category` accepts any topic slug and includes its descendants.
 */
export async function getEvents(opts: { category?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.category) params.set("category", opts.category);
  params.set("limit", String(opts.limit ?? 20));
  return get<{ events: MarketEvent[]; count: number }>(`/events?${params}`, 300);
}


export type PricePoint = { day: string; yes: number | null; volume_24h: number | null };

export type MarketDetail = {
  market: Market;
  /**
   * Daily closing probability, oldest first. Empty or one-length for markets
   * first seen after the recorder started — a page must degrade to "no history
   * yet" rather than assume it can draw a line.
   */
  history: PricePoint[];
  as_of: string;
};

export type IndexableMarket = {
  slug: string;
  title: string;
  title_fa: string | null;
  /**
   * Non-null when this market is one deadline of a rolling question ("…by
   * August 15" / "…by August 31"). Such a market does NOT get its own indexed
   * page — it canonicalizes to /question/<key>. See `getQuestionSeries`.
   */
  series_key: string | null;
  category_id: string | null;
  volume_24h: number | null;
  volume_total: number | null;
  close_time: string | null;
  status: string;
  outcome: string | null;
};

/** One market plus its price history — the market page's only data source. */
export async function getMarketDetail(slug: string): Promise<MarketDetail | null> {
  try {
    return await get<MarketDetail>(`/markets/${encodeURIComponent(slug)}`, DETAIL_TTL);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/**
 * The markets that qualify for a public, indexed page.
 *
 * The gate lives upstream on purpose: liquidity, having rules to show, and a
 * Persian title that passed verification are all facts about the DATA, and a
 * second copy of that logic here would drift. Used by generateStaticParams and
 * by the sitemap, so both always agree on what exists.
 *
 * Cached for an hour: the set changes as markets cross the volume threshold or
 * resolve, which is not a per-request concern.
 */
export async function getIndexableMarkets(): Promise<IndexableMarket[]> {
  try {
    const data = await get<{ markets: IndexableMarket[] }>("/markets/indexable", 3600);
    return data.markets;
  } catch {
    // A build must not fail because the API blinked; an empty list just means
    // no new market pages this build, and the existing ones stay published.
    return [];
  }
}

/** One deadline of a rolling question, as it appears in the family's timeline. */
export type SeriesMember = {
  slug: string;
  title: string;
  title_fa: string | null;
  status: string;
  outcome: string | null;
  close_time: string | null;
  probability: { yes: number; no: number } | null;
  volume: { total: number; h24: number };
  /** True for the leg the family currently headlines. */
  current: boolean;
};

export type SeriesSummary = {
  key: string;
  current: Omit<SeriesMember, "current">;
  category_id: string | null;
  member_slugs: string[];
  member_count: number;
  status: string;
};

export type QuestionSeries = {
  key: string;
  /** The market that answers the question today, in full detail. */
  market: Market;
  history: PricePoint[];
  /** Every deadline, oldest first, with how each one turned out. */
  members: SeriesMember[];
  as_of: string;
};

/**
 * Question families that deserve one canonical page.
 *
 * Polymarket re-lists the same question at successive deadlines, so publishing
 * a page per market would put five near-identical pages in front of one query
 * and retire each one's rankings on its deadline. One family page instead
 * accumulates them.
 */
export async function getQuestionSeriesIndex(): Promise<SeriesSummary[]> {
  try {
    const data = await get<{ series: SeriesSummary[] }>("/markets/series", 3600);
    return data.series;
  } catch {
    // Same rule as getIndexableMarkets: a blinking API must not fail a build.
    return [];
  }
}

export async function getQuestionSeries(key: string): Promise<QuestionSeries | null> {
  try {
    return await get<QuestionSeries>(`/markets/series/${encodeURIComponent(key)}`, DETAIL_TTL);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** One leg of a basket: a market, the side the basket holds, and its weight. */
export type BasketLeg = {
  side: "YES" | "NO";
  weight_bps: number;
  weight_pct: number;
  /**
   * Price of the side the basket actually holds — NOT always the YES price.
   * Null when the leg's book is empty. Use this, never `market.probability`,
   * when showing what a leg costs.
   */
  price: number | null;
  market: Market;
};

export type BasketSummary = {
  slug: string;
  title: string;
  title_fa: string | null;
  description: string | null;
  description_fa: string | null;
  curated: boolean;
  leg_count: number;
  /** "active" while any leg still trades; "settled" once they all have. */
  status: string;
  first_close_time: string | null;
  volume: { legs_total: number | null };
  stats: { buys: number; volume_usdc: number | null };
  /** Smallest leg weight — sets the basket's minimum stake. */
  min_weight_bps: number | null;
};

export type BasketDetail = {
  slug: string;
  title: string;
  title_fa: string | null;
  description: string | null;
  description_fa: string | null;
  curated: boolean;
  status: string;
  leg_count: number;
  /**
   * Weighted average of the legs' prices — what one unit of the basket costs as
   * a probability. Null unless EVERY leg is priced, so it is never a partial
   * average masquerading as the whole.
   */
  blended_probability: number | null;
  /**
   * At most one leg can resolve YES — five contenders, one trophy. Decides
   * which payout figure the page is allowed to quote.
   */
  exclusive: boolean;
  /** 'weights' | 'equal_shares' — how the stake is split across legs. */
  sizing: string;
  /**
   * What the basket returns if it comes good, per `notional` staked. Null when
   * any leg is unpriced, for the same reason `blended_probability` is: a figure
   * computed from some of the legs would misstate the whole basket.
   */
  payout: {
    notional: number;
    exclusive: boolean;
    /** Return if EVERY leg hits. Null on an exclusive basket — unreachable. */
    all_hit: number | null;
    multiple: number | null;
    /** Return if exactly one leg wins: worst and best case. */
    single_low: number;
    single_high: number;
    /**
     * Set when every single-winner payout is the same — the point of
     * equal-shares sizing. Lets the page state one figure instead of a range
     * whose ends differ only by rounding.
     */
    single_even: number | null;
    single_multiple: number | null;
    sizing: string;
  } | null;
  stats: { buys: number; volume_usdc: number | null };
  legs: BasketLeg[];
  as_of: string;
};

/**
 * Published baskets — curated sets of positions bought in one click.
 *
 * Cached for an hour: the set of baskets is editorial and changes when someone
 * publishes one, not per-request. Leg prices come from the detail call.
 */
export async function getBaskets(): Promise<BasketSummary[]> {
  try {
    const data = await get<{ baskets: BasketSummary[] }>("/baskets", 3600);
    return data.baskets;
  } catch {
    // Same rule as getIndexableMarkets: a blinking API must not fail a build.
    return [];
  }
}

export async function getBasket(slug: string): Promise<BasketDetail | null> {
  try {
    return await get<BasketDetail>(`/baskets/${encodeURIComponent(slug)}`, DETAIL_TTL);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
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

/**
 * A live 15-minute crypto up/down window.
 *
 * No title field: the title is generated client-side from window_start/end in
 * the reader's locale and timezone. Polymarket titles these in ET, and a string
 * that changes every fifteen minutes cannot live in a translation table.
 */
export type UpDownWindow = {
  market_id: string;
  slug: string;
  /** Ticker as stored in item_label — "BTC", "ETH", "SOL". */
  asset: string;
  up_price: number | null;
  down_price: number | null;
  up_label: string;
  down_label: string;
  window_start: string | null;
  window_end: string | null;
  seconds_left: number | null;
  volume: number | null;
};

/** A resolved up/down window, shown as proof that these actually settle. */
export type SettledUpDownWindow = {
  market_id: string;
  slug: string;
  asset: string;
  /** Winning SIDE — "YES" is Up (outcome index 0), not a price. */
  outcome: string;
  won: "up" | "down";
  up_label: string;
  down_label: string;
  window_start: string | null;
  window_end: string | null;
  volume: number | null;
};

/**
 * Live up/down windows.
 *
 * `revalidate: 0` — the only uncached call in this module, and deliberately so.
 * Every other route here describes something that changes over hours; a window
 * lives fifteen minutes, so even a 60s cache would serve markets that have
 * already expired. The page polls this client-side as the countdown runs.
 */
export async function getUpDownWindows(
  /**
   * 0, not 120: the web board SHOWS the running window all the way to expiry and
   * marks it closing, rather than having it vanish for its final two minutes —
   * which is the market a viewer is most likely actually watching. The bot keeps
   * the 120s guard, where the next step is a multi-step bet flow that can outlive
   * the window. Here nothing is placed from the board itself.
   */
  minSecondsLeft = 0,
): Promise<{ windows: UpDownWindow[]; settled: SettledUpDownWindow[] }> {
  try {
    const data = await get<{ windows: UpDownWindow[]; settled: SettledUpDownWindow[] }>(
      `/markets/updown?min_seconds_left=${minSecondsLeft}`,
      0,
    );
    return { windows: data.windows ?? [], settled: data.settled ?? [] };
  } catch {
    // Same rule as getIndexableMarkets: a blinking API must not fail a build.
    return { windows: [], settled: [] };
  }
}

/** Price series for one up/down window: price, opening anchor, running average. */
export type UpDownPrices = {
  symbol: string;
  anchor: number | null;
  points: Array<{ t: number; p: number; twap: number }>;
  started: boolean;
  complete: boolean;
};

/**
 * Window price history.
 *
 * Proxied through our own API rather than fetched from Binance here, because
 * Binance geo-blocks at both ends: Iranian readers cannot reach it from the
 * browser, and it returns 451 to US IPs, which is where these functions run.
 * The VPS is neither.
 *
 * revalidate 0 — a running window gains a bar every second; the upstream caches
 * finished windows itself.
 */
export async function getUpDownPrices(slug: string): Promise<UpDownPrices | null> {
  try {
    return await get<UpDownPrices>(
      `/markets/updown/prices?slug=${encodeURIComponent(slug)}`,
      0,
    );
  } catch {
    return null;
  }
}
