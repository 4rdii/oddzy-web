import { fa, faDayMonth, faDigits } from "./pb";
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

export type WorldApi = {
  countries: WorldApiCountry[];
  markets: WorldApiMarket[];
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
  /** «۳۱ دسامبر», or null when the market has no close date. */
  close: string | null;
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

export type WorldView = {
  countries: WC[];
  markets: WM[];
  /** Indices into markets: the 8 biggest absolute movers today. */
  movers: number[];
  totals: { countries: number; markets: number; vol24h: number };
  asOf: string | null;
};

const MAX_PANEL = 6;
const MAX_MOVERS = 8;
/** Thin markets swing on a single trade; keep them out of the movers strip. */
const MOVER_MIN_VOL = 1000;

const neighbors = NEIGHBORS as Record<string, string[]>;

export function emptyWorldView(): WorldView {
  return { countries: [], markets: [], movers: [], totals: { countries: 0, markets: 0, vol24h: 0 }, asOf: null };
}

/**
 * The design's derivations (handoff §5): a country's markets are those whose
 * countryIds include it, top 6 by volume; its arcs are the union of their
 * countries; movers are the 8 largest |change24h|. Only markets the page can
 * show are kept, which is what keeps the RSC payload small.
 */
export function toWorldView(w: WorldApi): WorldView {
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
        q: m.titleFa ? faDigits(m.titleFa) : m.title,
        ids: [...ids],
        p,
        v: m.vol24h || 0,
        close: m.closesAt ? faDayMonth(m.closesAt) : null,
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
        fa: c.fa,
        en: c.en,
        n: c.marketCount,
        v: c.vol24h,
        r: Math.round(c.risk),
        // "سیاست › ترامپ" → "ترامپ": chips carry the leaf, like the design's.
        topics: [...new Set(c.topics.map((t) => (t.fa || t.en).split("›").pop()!.trim()).filter(Boolean))],
        href: c.topicSlug ? `/topic/${c.topicSlug}` : `/world#${c.iso2}`,
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

  return {
    countries,
    markets,
    movers,
    totals: w.totals,
    asOf: w.as_of ?? null,
  };
}

/** «۱٫۳ میلیون دلار» / «۷۲۰ هزار دلار» (the design's `vol`, from USD). */
export function wVol(usd: number): string {
  const k = usd / 1000;
  return k >= 1000 ? `${fa((k / 1000).toFixed(1).replace(/\.0$/, ""))} میلیون دلار` : `${fa(Math.round(k))} هزار دلار`;
}

/** «۱٫۳M$» / «۷۲۰K$» (the design's `volS`, from USD). */
export function wVolS(usd: number): string {
  const k = usd / 1000;
  return k >= 1000 ? `${fa((k / 1000).toFixed(1).replace(/\.0$/, ""))}M$` : `${fa(Math.round(k))}K$`;
}
