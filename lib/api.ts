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

/**
 * Cache tag on the topics fetch. A day-long CATALOG_TTL means a newly added
 * league stays invisible for up to 24h; POST /api/revalidate {"tag":"topics"}
 * marks it stale instead (and, through Next's implicit tags, every page that
 * read it) so an addition shows on the next visit.
 */
export const TOPICS_TAG = "catalog-topics";

async function get<T>(path: string, revalidate: number, tags?: string[]): Promise<T> {
  if (!TOKEN) {
    throw new ApiError("ODDZY_API_TOKEN is not configured", 500);
  }
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    // The upstream snapshot only moves every ~30 min; revalidate well inside
    // that so a page is never staler than the data it describes.
    next: tags ? { revalidate, tags } : { revalidate },
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
 * Cache window for the SITE CATALOG: which topics, indexable markets and question
 * families exist. A day, because these describe the shape of the site, not a
 * price — and because they are read by SiteChrome on every page.
 *
 * That second fact is what made them expensive. A route regenerates at the
 * LOWEST revalidate of any fetch it makes (the trap e351ac9 fixed once), and the
 * footer's getTopics() sat at 900s. Measured from the build's prerender manifest
 * on 2026-09-14: all 1000 market pages, 232 question pages and every topic,
 * learn, faq and basket page regenerated every 15 minutes regardless of the
 * `revalidate` each one declared — and market pages alone were ~90% of the
 * account's ISR write units, nearly one write per read.
 *
 * Cost of a day: a newly added topic, or a market that just crossed the
 * indexable gate, takes up to 24h to appear in the nav, footer and sitemap. The
 * pages themselves still render on demand in the meantime.
 */
const CATALOG_TTL = 86400;

/**
 * Cache window for a single market page. See app/[lang]/market/[slug]/page.tsx —
 * the segment's `revalidate` must equal this, and every fetch the page makes
 * must be at least this, or the route silently regenerates faster.
 */
export const MARKET_TTL = 86400;

/**
 * The navigation tree, exactly as the bot models it (see /topics upstream).
 * CATALOG_TTL — the shape changes when topics are added, not per-request, and
 * this is read on every page via SiteChrome, so its window caps the whole site.
 */
export async function getTopics(): Promise<Topic[]> {
  const data = await get<{ topics: Topic[] }>("/topics", CATALOG_TTL, [TOPICS_TAG]);
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
   * Set when this market is part of a sports match with 2+ markets. Such a
   * market has no page of its own: the market page redirects to
   * /match/<slug>, which carries the result and every sub-market.
   */
  match?: { slug: string } | null;
  /** Set when this market is one price level of a ladder page: it redirects there. */
  ladder?: { key: string } | null;
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
  /**
   * When we first listed this market — the only content-change timestamp it
   * has. Its price moves constantly; its question and rules are written once.
   */
  first_seen: string | null;
  status: string;
  outcome: string | null;
};

/** One side of a match's headline result, as /events/{slug} summarises it. */
export type MatchResultOption = {
  label: string;
  label_fa: string | null;
  /** The market to trade this side on. Both sides of a fight share one. */
  slug: string;
  p: number | null;
  /** true/false once settled, null while live. */
  won: boolean | null;
};

/** One fixture's whole board: headline result plus every market, grouped. */
export type EventBoard = {
  event: {
    id: string;
    short_id: string;
    title: string;
    title_fa: string | null;
    kind: string;
    starts_at: string | null;
    status: string;
    topic: { id: string; name: string; name_fa: string | null } | null;
  };
  market_count: number;
  /**
   * three_way (football: win / draw / win), two_way (two win markets, no
   * draw) or head_to_head (a fight: ONE market, YES = the first-named side).
   */
  result: { type: "three_way" | "two_way" | "head_to_head"; options: MatchResultOption[] } | null;
  groups: { key: string; label: string; count: number; markets: EventMarket[] }[];
  as_of: string;
};

export type IndexableEvent = {
  slug: string;
  title: string;
  title_fa: string | null;
  starts_at: string | null;
  status: string;
  topic_id: string | null;
  market_count: number;
  volume_24h: number | null;
  volume: number | null;
};

/**
 * A match page's data. include_settled so a finished match keeps its board
 * and shows how each market resolved, instead of rendering empty.
 */
export async function getEventBoard(slug: string): Promise<EventBoard | null> {
  try {
    return await get<EventBoard>(`/events/${encodeURIComponent(slug)}?include_settled=true`, MARKET_TTL);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/**
 * The match pages that qualify for indexing. A sports match is ONE page; none
 * of its markets is indexed on its own (they are absent from
 * getIndexableMarkets). Same fallback rule: an API blink yields [] rather than
 * failing the build.
 */
export async function getIndexableEvents(): Promise<IndexableEvent[]> {
  try {
    const data = await get<{ events: IndexableEvent[] }>("/events/indexable", CATALOG_TTL);
    return data.events;
  } catch {
    return [];
  }
}

/** One market plus its price history — the market page's only data source. */
export async function getMarketDetail(slug: string): Promise<MarketDetail | null> {
  try {
    return await get<MarketDetail>(`/markets/${encodeURIComponent(slug)}`, MARKET_TTL);
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
 * CATALOG_TTL: the set changes as markets cross the volume threshold or resolve,
 * which is not a per-request concern — and SiteChrome reads it on every page.
 */
export async function getIndexableMarkets(): Promise<IndexableMarket[]> {
  try {
    const data = await get<{ markets: IndexableMarket[] }>("/markets/indexable", CATALOG_TTL);
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

/** One price level of a ladder (asset × time frame) page. */
export type LadderRung = Omit<SeriesMember, "current"> & {
  /** "Above $80,000", "Dip to $2,600", "$80,000 – $82,000" (English). */
  label: string;
  dir: "above" | "below" | "range" | "high" | "low";
  amounts: number[];
};

/**
 * Every price level of one asset over one time frame, grouped by period (a
 * day, week, month or deadline): open periods soonest first, then the most
 * recent closed ones.
 */
export type Ladder = {
  asset: { key: string; name: string; name_fa: string | null };
  timeframe: "daily" | "weekly" | "monthly" | "long";
  periods: { key: string; label: string; close_time: string | null; open: boolean; rungs: LadderRung[] }[];
};

export type SeriesSummary = {
  key: string;
  /** "ladder" = one asset's price levels over a time frame; "rolling" = one question re-listed at new deadlines. */
  kind?: "ladder" | "rolling";
  ladder?: { asset: Ladder["asset"]; timeframe: Ladder["timeframe"] } | null;
  current: Omit<SeriesMember, "current">;
  category_id: string | null;
  /** Newest member's listing date — when the family last gained a deadline. */
  newest_first_seen: string | null;
  member_slugs: string[];
  member_count: number;
  status: string;
};

export type QuestionSeries = {
  /** Set instead of everything else when an old key now lives on a ladder page. */
  moved_to?: string;
  /** Present on a ladder page; `members` is then empty. */
  ladder?: Ladder | null;
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
    // CATALOG_TTL: read by SiteChrome on every page, via publishedTopicSlugs.
    const data = await get<{ series: SeriesSummary[] }>("/markets/series", CATALOG_TTL);
    return data.series;
  } catch {
    // Same rule as getIndexableMarkets: a blinking API must not fail a build.
    return [];
  }
}

/**
 * `revalidate` is a parameter because two routes read this with different
 * budgets: the question page at DETAIL_TTL, and the market page (to find a
 * market's family) at MARKET_TTL — where DETAIL_TTL would drag the market route
 * back down to an hour.
 */
export async function getQuestionSeries(
  key: string,
  revalidate: number = DETAIL_TTL,
): Promise<QuestionSeries | null> {
  try {
    return await get<QuestionSeries>(`/markets/series/${encodeURIComponent(key)}`, revalidate);
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
  /** Publication date — a basket's legs are fixed at publish, so this dates the page. */
  published_at: string | null;
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
  /**
   * No longer buyable. Set when the expiry sweep archives the basket, which
   * happens at CLOSE time and can therefore precede settlement — so this can be
   * true while `status` is still "active". Gate the buy CTA on this, never on
   * `status`, or the page offers a purchase that cannot be made.
   */
  archived: boolean;
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
  /**
   * What $100 in this basket would have returned, scored at the legs' PUBLISH
   * prices — deliberately the same basis as the creator profile's per-basket
   * return, so one basket never shows two different numbers on two pages. It is
   * not what any individual buyer made; their entry price differed.
   *
   * Null while any leg is undecided or unpriced: a partially-scored basket would
   * read as a finished one.
   */
  result: {
    notional: number;
    returned: number;
    pnl: number;
    multiple: number;
    won: number;
    settled: number;
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
 * The shortest-lived call in this module: seconds, where everything else here
 * caches for an hour. A window lives fifteen minutes, so a 60s cache would serve
 * markets that have already expired.
 *
 * SECONDS, THOUGH — NOT ZERO. `next: { revalidate: 0 }` is a no-store fetch, and
 * a no-store fetch drags the whole enclosing route into dynamic rendering no
 * matter what its segment config says. That is how /updown ended up re-rendering
 * on every single view while its build output cheerfully reported `SSG 5s`: the
 * segment was prerenderable, the fetch inside it was not, and the fetch wins.
 * Any small non-zero number keeps the route prerenderable and still expires long
 * before a fifteen-minute window does.
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
  /**
   * Seconds to hold the upstream response. The page seeds a board that the
   * client repaints within 5s of mount, so it wants the cheaper, cacheable end
   * of this; /api/updown is what the board actually polls and wants the fresher.
   */
  revalidate = 5,
): Promise<{ windows: UpDownWindow[]; settled: SettledUpDownWindow[] }> {
  try {
    const data = await get<{ windows: UpDownWindow[]; settled: SettledUpDownWindow[] }>(
      `/markets/updown?min_seconds_left=${minSecondsLeft}`,
      revalidate,
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
