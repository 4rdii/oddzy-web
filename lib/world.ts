import { digitsOf, fa, faDayMonth, faDigits, type PbLang } from "./pb";
import NEIGHBORS from "./world-neighbors.json";

/**
 * «نقشهٔ جهان» (design: PB World Map) — the API contract and the view model
 * the page renders.
 *
 * `toWorldView` runs on the server only (the page and /api/world), so the
 * client never formats a date or recomputes a colour: what it hydrates is
 * byte-identical to what the server rendered, and the 60s refresh hands it
 * the same shape again.
 */

/** GET /world (oddzy-api). Countries are sorted by vol24h desc. */
export type WorldApiCountry = {
  /** ISO 3166-1 numeric, zero-padded ("004"), matching world-atlas ids; null for Kosovo. */
  id: string | null;
  iso2: string;
  en: string;
  fa: string;
  marketCount: number;
  /** USD. */
  vol24h: number;
  /** 0–100. */
  risk: number;
  topics: { slug: string; fa: string; en: string }[];
  /** The country's topic page; null → no country CTA. */
  topicSlug: string | null;
};

export type WorldApiMarket = {
  id: string;
  slug: string;
  title: string;
  titleFa: string | null;
  iso2: string[];
  countryIds: (string | null)[];
  /** 0–100. */
  yesProb: number | null;
  vol24h: number;
  closesAt: string | null;
  /** Percentage points. */
  change24h: number | null;
  topic?: unknown;
};

/** A news story (DW / BBC Persian), tagged with countries and markets upstream. */
export type WorldApiNews = {
  /** = url. */
  id: string;
  titleFa: string;
  summaryFa: string;
  /** «دویچه‌وله فارسی» | «بی‌بی‌سی فارسی». */
  source: string;
  url: string;
  /** ISO. */
  publishedAt: string;
  iso2: string[];
  /** ISO numeric, matching countries[].id. */
  countryIds: string[];
  /** Ids into markets[]; may be empty. */
  marketIds: string[];
};

export type WorldApi = {
  countries: WorldApiCountry[];
  markets: WorldApiMarket[];
  /** Newest first, at most 20. */
  news?: WorldApiNews[];
  totals: { countries: number; markets: number; vol24h: number };
  scanned?: number;
  tagged?: number;
  as_of: string;
  max_staleness_minutes?: number;
};

/** A market as the page shows it (the design's `M` row). */
export type WM = {
  slug: string;
  /** Persian title, English when untranslated. */
  q: string;
  /** Country keys involved (see WC.key). */
  ids: string[];
  /** Whole percent, or null when unknown. */
  p: number | null;
  /** USD, 24h. */
  v: number;
  /** «۳۱ دسامبر» (fa, Tehran), or null when the market has no close date. */
  close: string | null;
  /** ISO close time: en formats it on the client in the viewer's zone. */
  closeAt: string | null;
  /** Today's change in whole points; null/0 = no change shown. */
  d: number | null;
};

/** A country as the page shows it (the design's `C` row). */
export type WC = {
  /** The numeric id where the atlas has one (the globe joins on it), else "x-" + iso2. */
  key: string;
  /** Atlas id, or null when the country is not on the map. */
  geo: string | null;
  iso2: string;
  fa: string;
  en: string;
  /** The display name in the page's language (fa or en). */
  name: string;
  /** Active markets. */
  n: number;
  /** USD, 24h. */
  v: number;
  /** Risk score 0–100. */
  r: number;
  topics: string[];
  /** The ranked row's href: the country page, or this page's anchor for the country. */
  href: string;
  /** Country CTA target; null hides the CTA. */
  cta: string | null;
  /** Indices into WorldView.markets: the country's markets by 24h volume, top 6. */
  mk: number[];
  /** Keys of countries sharing a market with this one (the arcs). */
  links: string[];
  /** Palette slot 0–6, assigned so neighbours never share one. */
  ci: number;
};

/** A news story as the page shows it (the design's `NEWS` row). */
export type WN = {
  /** = url. */
  id: string;
  /** Headline. */
  q: string;
  /** One-line summary. */
  s: string;
  src: string;
  url: string;
  /** ISO publish time; the relative «۱۲ دقیقه پیش» is formatted on the client (it ticks). */
  at: string;
  /** Country keys (see WC.key) of the countries on this page, in the story's order. */
  ids: string[];
  /** Indices into WorldView.markets: the story's related markets that the page has. */
  mk: number[];
};

export type WorldView = {
  countries: WC[];
  markets: WM[];
  /** Newest first. */
  news: WN[];
  /** Indices into markets: the 8 biggest absolute movers today. */
  movers: number[];
  totals: { countries: number; markets: number; vol24h: number };
  asOf: string | null;
};

export type RegionKey = "all" | "me" | "eu" | "am" | "as" | "af";
export type Region = { k: RegionKey; c?: [number, number]; z?: number; ids?: number[] };

/** The region chips: fly-to centre and zoom, members (atlas ids). Shared by the globe and the news feed filter. Labels: dict `world.regions`. */
export const REGIONS: Region[] = [
  { k: "all" },
  { k: "me", c: [46, 29], z: 2.6, ids: [364, 376, 422, 760, 368, 682, 887, 792, 818, 634, 784, 512, 400] },
  { k: "eu", c: [28, 50], z: 2, ids: [643, 804, 276, 250, 826, 616, 348, 642, 498, 112, 268, 51, 31] },
  { k: "am", c: [-78, 18], z: 1.25, ids: [840, 124, 484, 862, 76, 32, 170, 192, 304] },
  { k: "as", c: [108, 28], z: 1.7, ids: [156, 158, 408, 410, 392, 586, 356, 4, 608] },
  { k: "af", c: [22, 6], z: 1.6, ids: [729, 231, 706, 434, 566, 180, 818] },
];
const pad = (n: number) => String(n).padStart(3, "0");
/** Region key → member country keys (null = the whole world). */
export const REG_SET: Record<string, Set<string> | null> = Object.fromEntries(
  REGIONS.map((r) => [r.k, r.ids ? new Set(r.ids.map(pad)) : null]),
);

const MAX_PANEL = 6;
const MAX_MOVERS = 8;
/** Thin markets swing on a single trade; keep them out of the movers strip.
 *  1k let $1.5k-a-day markets lead with ±10pt moves that read as fake (2026-10-13). */
const MOVER_MIN_VOL = 10_000;

const neighbors = NEIGHBORS as Record<string, string[]>;

export function emptyWorldView(): WorldView {
  return { countries: [], markets: [], news: [], movers: [], totals: { countries: 0, markets: 0, vol24h: 0 }, asOf: null };
}

/**
 * The design's derivations (handoff §5): a country's markets are those whose
 * countryIds include it, top 6 by volume; its arcs are the union of their
 * countries; movers are the 8 largest |change24h|. Only markets the page can
 * show are kept, which is what keeps the RSC payload small.
 */
export function toWorldView(w: WorldApi, lang: PbLang = "fa"): WorldView {
  const keyOf = (c: WorldApiCountry) => c.id ?? `x-${c.iso2}`;
  const byIso = new Map(w.countries.map((c) => [c.iso2, keyOf(c)]));
  const known = new Set(w.countries.map(keyOf));

  const all = w.markets.map((m) => {
    const ids = new Set<string>();
    for (const id of m.countryIds ?? []) if (id && known.has(id)) ids.add(id);
    for (const iso of m.iso2 ?? []) {
      const k = byIso.get(iso);
      if (k) ids.add(k);
    }
    const p = m.yesProb === null || m.yesProb === undefined || !Number.isFinite(m.yesProb) ? null : Math.round(m.yesProb);
    const d = m.change24h === null || m.change24h === undefined || !Number.isFinite(m.change24h) ? null : Math.round(m.change24h);
    return {
      raw: m,
      view: {
        slug: m.slug,
        // Translated titles keep Latin digits ("2027"); the page writes Persian ones everywhere.
        q: lang === "fa" ? (m.titleFa ? faDigits(m.titleFa) : m.title) : m.title || m.titleFa || "",
        ids: [...ids],
        p,
        v: m.vol24h || 0,
        close: m.closesAt && lang === "fa" ? faDayMonth(m.closesAt) : null,
        closeAt: m.closesAt ?? null,
        d: d || null,
      } satisfies WM,
    };
  });

  const keep = new Map<(typeof all)[number], number>();
  const markets: WM[] = [];
  const idx = (x: (typeof all)[number]) => {
    let i = keep.get(x);
    if (i === undefined) {
      i = markets.length;
      markets.push(x.view);
      keep.set(x, i);
    }
    return i;
  };

  const countries: WC[] = [...w.countries]
    .sort((a, b) => b.vol24h - a.vol24h)
    .map((c) => {
      const key = keyOf(c);
      const mine = all.filter((x) => x.view.ids.includes(key)).sort((a, b) => b.view.v - a.view.v);
      const links = [...new Set(mine.flatMap((x) => x.view.ids))].filter((x) => x !== key);
      return {
        key,
        geo: c.id,
        iso2: c.iso2,
        // Oddzy never shows the Persian name; keep it out of the payload.
        fa: lang === "fa" ? c.fa : "",
        en: c.en,
        name: lang === "fa" ? c.fa : c.en || c.iso2,
        n: c.marketCount,
        v: c.vol24h,
        r: Math.round(c.risk),
        // "سیاست › ترامپ" → "ترامپ": chips carry the leaf, like the design's.
        topics: [...new Set(c.topics.map((t) => (lang === "fa" ? t.fa || t.en : t.en || "").split("›").pop()!.trim()).filter(Boolean))],
        // Oddzy's map is its home page (/world redirects there).
        href: c.topicSlug ? `/topic/${c.topicSlug}` : `${lang === "fa" ? "/world" : "/"}#${c.iso2}`,
        cta: c.topicSlug ? `/topic/${c.topicSlug}` : null,
        mk: mine.slice(0, MAX_PANEL).map(idx),
        links,
        ci: 0,
      };
    });

  // Greedy by volume: each country takes the first palette slot none of its
  // already-coloured neighbours uses (topojson.neighbors, precomputed).
  const byKey = new Map(countries.map((c) => [c.key, c]));
  const done = new Set<string>();
  for (const c of countries) {
    const used = new Set(
      (c.geo ? neighbors[c.geo] ?? [] : []).filter((id) => done.has(id)).map((id) => byKey.get(id)!.ci),
    );
    c.ci = [0, 1, 2, 3, 4, 5, 6].find((k) => !used.has(k)) ?? 0;
    done.add(c.key);
  }

  const movers = all
    .filter((x) => x.view.d && x.view.v >= MOVER_MIN_VOL)
    .sort((a, b) => Math.abs(b.view.d!) - Math.abs(a.view.d!))
    .slice(0, MAX_MOVERS)
    .map(idx);

  const byMarketId = new Map(all.map((x) => [x.raw.id, x]));
  const news: WN[] = (w.news ?? []).map((n) => {
    const ids = new Set<string>();
    for (const id of n.countryIds ?? []) if (id && known.has(id)) ids.add(id);
    for (const iso of n.iso2 ?? []) {
      const k = byIso.get(iso);
      if (k) ids.add(k);
    }
    return {
      id: n.id,
      // On en the API (GET /world?lang=en) puts the English story in the *Fa fields.
      q: digitsOf(lang, n.titleFa),
      s: digitsOf(lang, n.summaryFa ?? ""),
      src: n.source,
      url: n.url,
      at: n.publishedAt,
      ids: [...ids],
      mk: [...new Set(n.marketIds ?? [])].flatMap((id) => {
        const x = byMarketId.get(id);
        return x ? [idx(x)] : [];
      }),
    };
  });

  return {
    countries,
    markets,
    news,
    movers,
    totals: w.totals,
    asOf: w.as_of ?? null,
  };
}

/** «۱٫۳ میلیون دلار» / «۷۲۰ هزار دلار» (the design's `vol`, from USD); "$1.3M" / "$720K" for en. */
export function wVol(usd: number, lang: PbLang = "fa"): string {
  const k = usd / 1000;
  if (lang === "en") return wVolS(usd, lang);
  return k >= 1000 ? `${fa((k / 1000).toFixed(1).replace(/\.0$/, ""))} میلیون دلار` : `${fa(Math.round(k))} هزار دلار`;
}

/** «۱٫۳M$» / «۷۲۰K$» (the design's `volS`, from USD); "$1.3M" / "$720K" for en. */
export function wVolS(usd: number, lang: PbLang = "fa"): string {
  const k = usd / 1000;
  if (lang === "en") return k >= 1000 ? `$${(k / 1000).toFixed(1).replace(/\.0$/, "")}M` : `$${Math.round(k)}K`;
  return k >= 1000 ? `${fa((k / 1000).toFixed(1).replace(/\.0$/, ""))}M$` : `${fa(Math.round(k))}K$`;
}
