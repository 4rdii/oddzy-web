/**
 * Oddzy (oddzy.xyz) redesign — the /desk contract and the formatters every
 * Od* component shares. Client-safe: no fetches here (see lib/desk.ts).
 *
 * Design source: "Oddzy Redesign" (Claude Design), od-data.js. Percentages are
 * 0–100, money is USD, changes are percentage points since yesterday's close.
 */

export type SecKey = "war" | "pol" | "eco";

export type DeskMarket = {
  id: string;
  slug: string;
  title: string;
  sec: SecKey;
  /** Subtopic slug (= topic slug). */
  sub: string;
  iso2: string[];
  /** ISO numeric ids, matching the globe's atlas. */
  countryIds: string[];
  yes: number;
  chg: number | null;
  vol24h: number;
  volTotal: number;
  closesAt: string | null;
  /** "Oct 31", "Jun 30 ’27". */
  close: string | null;
  /** Daily closes, oldest first, ending on the live price. */
  spark: number[];
  /** Family key when the market is a rung / outcome of one. */
  fam: string | null;
  /** Its label inside the family ("Oct 31", "Marine Le Pen"). */
  lab: string | null;
};

export type DeskFamily = {
  key: string;
  /** ladder = one question at several deadlines; race = one event's outcomes. */
  t: "ladder" | "race";
  title: string;
  /** Market ids, in display order. */
  m: string[];
  /** Members in the whole family (m is capped). */
  n: number;
};

export type DeskSection = {
  key: SecKey;
  /** Topic slug: /topic/<slug>. */
  slug: string;
  name: string;
  short: string;
  dek: string;
  subs: string[];
  markets: number;
  vol24h: number;
};

export type DeskSub = { slug: string; sec: SecKey; name: string; dek: string | null; markets: number; vol24h: number };

export type DeskCountry = {
  id: string | null;
  iso2: string;
  en: string;
  marketCount: number;
  vol24h: number;
  risk: number;
  topicSlug: string | null;
};

export type DeskNews = {
  id: string;
  /** English on /desk (the field name predates English). */
  titleFa: string;
  summaryFa: string;
  source: string;
  url: string;
  publishedAt: string;
  iso2: string[];
  countryIds: string[];
  marketIds: string[];
};

export type Desk = {
  sections: DeskSection[];
  subs: DeskSub[];
  markets: DeskMarket[];
  families: DeskFamily[];
  countries: DeskCountry[];
  news: DeskNews[];
  totals: { countries: number; markets: number; vol24h: number };
  as_of: string;
};

// ---------------------------------------------------------------- formatters

/** $8.1M / $307K / $640. */
export function fmtV(usd: number): string {
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (usd >= 1e3) return `$${Math.round(usd / 1e3)}K`;
  return `$${Math.round(usd)}`;
}

/** Whole points: ▲3 / ▼4 / 0. */
export function chg(d: number | null): string {
  if (d === null) return "—";
  const r = Math.round(d);
  return r > 0 ? `▲${r}` : r < 0 ? `▼${Math.abs(r)}` : "0";
}

/** CSS colour for a change. */
export function chgCol(d: number | null): string {
  const r = d === null ? 0 : Math.round(d);
  return r > 0 ? "var(--od-up)" : r < 0 ? "var(--od-down)" : "var(--od-ink3)";
}

export function chgBg(d: number | null): string {
  const r = d === null ? 0 : Math.round(d);
  return r > 0 ? "var(--od-upBg)" : r < 0 ? "var(--od-downBg)" : "var(--od-chip)";
}

/** Probability shown as a whole number (80%), one decimal under 1. */
export function pct(p: number): string {
  return p < 1 ? p.toFixed(1) : String(Math.round(p));
}

export function word(p: number): string {
  return p >= 95 ? "Near certain" : p >= 65 ? "Likely" : p >= 35 ? "Toss-up" : p >= 6 ? "Unlikely" : "Remote";
}

/** "41 min ago" / "3 hr ago" / "2 days ago". */
export function ago(iso: string, now: number): string {
  const m = Math.max(1, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} hr ago`;
  return `${Math.floor(h / 24)} days ago`;
}

/** "41m" / "3h" / "2d" — the wire's left column. */
export function agoShort(iso: string, now: number): string {
  const m = Math.max(1, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

/** Sparkline path, scaled to its own range (at least 4 points tall). */
export function sparkPath(h: number[], w = 64, ht = 20, n = 30): string {
  const s = h.slice(-n);
  if (s.length < 2) return `M0 ${ht / 2} L${w} ${ht / 2}`;
  const lo = Math.min(...s), hi = Math.max(...s), rg = Math.max(4, hi - lo), mid = (hi + lo) / 2;
  return s.map((v, i) => `${i ? "L" : "M"}${((i / (s.length - 1)) * w).toFixed(1)} ${(ht / 2 - ((v - mid) / rg) * (ht - 2)).toFixed(1)}`).join(" ");
}

/** 0–100 chart: the line and the filled area under it. */
export function chartPaths(h: number[], w: number, ht: number): { line: string; area: string } {
  const s = h.length >= 2 ? h : h.length === 1 ? [h[0], h[0]] : [50, 50];
  const y = (v: number) => ht - (v / 100) * ht;
  const line = s.map((v, i) => `${i ? "L" : "M"}${((i / (s.length - 1)) * w).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return { line, area: `${line} L${w} ${ht} L0 ${ht} Z` };
}

export const marketUrl = (slug: string) => `/market/${slug}`;
export const topicUrl = (slug: string) => `/topic/${slug}`;

/** Two-letter codes as the design prints them: "US · IR". */
export function codes(iso2: string[], max = 3): string {
  return iso2.slice(0, max).join(" · ");
}

/** Shorten for the ticker. */
export function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 2).trim()}…` : s;
}

/** A market row as the lists render it (server → client props stay small). */
export type OdRow = {
  id: string;
  slug: string;
  q: string;
  p: number;
  chg: number | null;
  vol: number;
  close: string | null;
  codes: string;
  sub: string;
  subName: string;
  sp: string;
};

/** Rows sorted by "Volume" / "Movers" / "All-time" in the section table. */
export type OdSort = "vol" | "move" | "tot";

/**
 * Subtopic slug → its section, for the header's current-page mark on pages
 * that only know their own slug. Mirrors SECTIONS in oddzy-api/desk.js.
 */
export const SUB_SECTION: Record<string, SecKey> = {
  world: "war", iran: "war", israel: "war", gaza: "war", "lebanon-syria": "war", "middle-east": "war", "gulf-iraq": "war",
  "yemen-red-sea": "war", turkey: "war", "pakistan-afghanistan": "war", ukraine: "war", "nato-russia": "war",
  "china-taiwan": "war", venezuela: "war", "world-conflicts": "war",
  politics: "pol", midterms: "pol", "midterms-balance": "pol", "midterms-gop-seats": "pol", "midterms-house": "pol",
  "midterms-senate": "pol", "midterms-races": "pol", trump: "pol", "global-elections": "pol", europe: "pol",
  "latin-america": "pol", "asia-pacific": "pol", canada: "pol", africa: "war", "economy-central-banks": "eco",
  economy: "eco", "economy-fed": "eco", "economy-inflation": "eco", "economy-oil": "eco", "economy-tradewar": "eco",
  "economy-stocks": "eco", "economy-spx": "eco", "economy-gold": "eco", "economy-ipo": "eco",
};

export const SEC_SLUG: Record<SecKey, string> = { war: "world", pol: "politics", eco: "economy" };

/** One ticker item (header wire). */
export type OdTick = { url: string; codes: string; short: string; p: string; chg: string; up: boolean };
