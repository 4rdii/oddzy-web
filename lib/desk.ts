import "server-only";

import type { FamView } from "@/components/od/parts";
import { ago, codes, marketUrl, sparkPath, type Desk, type DeskMarket, type DeskNews, type OdRow, type SecKey } from "./od";

/**
 * View-model builders over GET /desk, shared by the oddzy.xyz home, section
 * and subtopic pages. Server-only: pages hand their client islands the small
 * slices built here, never the ~700KB payload.
 */

export type DeskIndex = {
  desk: Desk;
  byId: Map<string, DeskMarket>;
  subName: (slug: string) => string;
};

export function indexDesk(desk: Desk): DeskIndex {
  const byId = new Map(desk.markets.map((m) => [m.id, m]));
  const names = new Map(desk.subs.map((s) => [s.slug, s.name]));
  return { desk, byId, subName: (s) => names.get(s) ?? s };
}

export function famView(ix: DeskIndex, key: string): FamView | null {
  const f = ix.desk.families.find((x) => x.key === key);
  if (!f) return null;
  const stops = f.m
    .map((id) => ix.byId.get(id))
    .filter((m): m is DeskMarket => !!m)
    .map((m) => ({ id: m.id, slug: m.slug, lab: m.lab ?? m.close ?? "", p: m.yes, chg: m.chg, url: marketUrl(m.slug), vol: m.vol24h }));
  if (stops.length < 2) return null;
  return { key: f.key, t: f.t, title: f.title, stops, n: f.n };
}

/** Families whose markets sit in `sec` (or `sub`), biggest first. */
export function famsIn(ix: DeskIndex, where: { sec?: SecKey; sub?: string }): string[] {
  return ix.desk.families
    .filter((f) => {
      const m = ix.byId.get(f.m[0]);
      return !!m && (!where.sec || m.sec === where.sec) && (!where.sub || m.sub === where.sub);
    })
    .map((f) => f.key);
}

export function row(ix: DeskIndex, m: DeskMarket): OdRow {
  return {
    id: m.id,
    slug: m.slug,
    q: m.title,
    p: m.yes,
    chg: m.chg,
    vol: m.vol24h,
    close: m.close,
    codes: codes(m.iso2),
    sub: m.sub,
    subName: ix.subName(m.sub),
    sp: sparkPath(m.spark),
  };
}

export type MiniMarket = { id: string; slug: string; q: string; p: number; chg: number | null; vol: number; close: string | null; url: string; codes: string; sp: string };
export function mini(m: DeskMarket): MiniMarket {
  return { id: m.id, slug: m.slug, q: m.title, p: m.yes, chg: m.chg, vol: m.vol24h, close: m.close, url: marketUrl(m.slug), codes: codes(m.iso2), sp: sparkPath(m.spark) };
}

/** The story's market that moved most today (the wire's pill). */
export function newsMarkets(ix: DeskIndex, n: DeskNews): DeskMarket[] {
  return n.marketIds.map((id) => ix.byId.get(id)).filter((m): m is DeskMarket => !!m);
}

export function newsSection(ix: DeskIndex, n: DeskNews): SecKey {
  const ms = newsMarkets(ix, n);
  const count: Record<string, number> = {};
  for (const m of ms) count[m.sec] = (count[m.sec] ?? 0) + 1;
  return ((Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] as SecKey) ?? "war");
}

export type NewsItem = {
  k: string;
  q: string;
  s: string;
  src: string;
  url: string;
  at: string;
  ago: string;
  sec: SecKey;
  ids: string[];
  countries: string;
  count: number;
  /** The linked market that moved most; null when the story links none on the desk. */
  m: MiniMarket | null;
  /** Up to three linked markets for the globe card. */
  mk: MiniMarket[];
};

export function newsItems(ix: DeskIndex, now: number, filter?: (n: DeskNews, ms: DeskMarket[]) => boolean): NewsItem[] {
  const cname = new Map(ix.desk.countries.filter((c) => c.id).map((c) => [c.id as string, c.en]));
  const out: NewsItem[] = [];
  ix.desk.news.forEach((n, i) => {
    const ms = newsMarkets(ix, n);
    if (filter && !filter(n, ms)) return;
    const top = [...ms].sort((a, b) => Math.abs(b.chg ?? 0) - Math.abs(a.chg ?? 0))[0];
    out.push({
      k: `n${i}`,
      q: n.titleFa,
      s: n.summaryFa,
      src: n.source,
      url: n.url,
      at: n.publishedAt,
      ago: ago(n.publishedAt, now),
      sec: newsSection(ix, n),
      ids: n.countryIds,
      countries: n.countryIds.map((id) => cname.get(id)).filter(Boolean).join(", "),
      count: ms.length,
      m: top ? mini(top) : null,
      mk: [...ms].sort((a, b) => b.vol24h - a.vol24h).slice(0, 3).map(mini),
    });
  });
  return out;
}

export type Lead = {
  head: string;
  /** Section and subtopic names for the kicker. */
  secName: string;
  subName: string;
  fam: FamView | null;
  key: MiniMarket & { tot: number; spark: number[] };
  news: { src: string; ago: string; q: string; k: string }[];
  /** Countries involved, ids (first = primary). */
  ids: string[];
};

/**
 * The lead story: the biggest family (or market) in scope that today's wire
 * links to, headlined with the story itself. Without a linked story, the
 * biggest family, headlined with its own question.
 */
export function pickLead(ix: DeskIndex, now: number, where: { sec?: SecKey; sub?: string } = {}): Lead | null {
  const inScope = (m: DeskMarket | undefined) => !!m && (!where.sec || m.sec === where.sec) && (!where.sub || m.sub === where.sub);
  const linked = new Map<string, DeskNews[]>();
  for (const n of ix.desk.news) for (const id of n.marketIds) linked.set(id, [...(linked.get(id) ?? []), n]);

  // Candidates: families and lone markets in scope, by 24h volume.
  type Cand = { ids: string[]; fam: string | null; vol: number };
  const cands: Cand[] = [];
  for (const f of ix.desk.families) {
    const ms = f.m.map((id) => ix.byId.get(id));
    if (!inScope(ms[0])) continue;
    cands.push({ ids: f.m, fam: f.key, vol: ms.reduce((a, m) => a + (m?.vol24h ?? 0), 0) });
  }
  for (const m of ix.desk.markets) if (inScope(m) && !m.fam) cands.push({ ids: [m.id], fam: null, vol: m.vol24h });
  cands.sort((a, b) => b.vol - a.vol);
  if (!cands.length) return null;

  // Prefer a story the wire covers, among the 40 biggest; a quiet day falls back to the biggest.
  const withNews = cands.slice(0, 40).find((c) => c.ids.some((id) => linked.has(id)));
  const c = withNews ?? cands[0];
  const ms = c.ids.map((id) => ix.byId.get(id)!).filter(Boolean);
  const key = [...ms].sort((a, b) => b.vol24h - a.vol24h)[0];
  const stories = [...new Set(c.ids.flatMap((id) => linked.get(id) ?? []))].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const fam = c.fam ? famView(ix, c.fam) : null;
  const sec = ix.desk.sections.find((s) => s.key === key.sec);
  const ids = [...new Set(ms.flatMap((m) => m.countryIds))];
  return {
    head: stories[0]?.titleFa ?? key.title,
    secName: sec?.name ?? "",
    subName: ix.subName(key.sub),
    fam,
    key: { ...mini(key), tot: key.volTotal, spark: key.spark },
    news: stories.slice(0, 2).map((n, i) => ({ src: n.source, ago: ago(n.publishedAt, now), q: n.titleFa, k: `${i}` })),
    ids,
  };
}

/** Daily dates for a spark that ends today. */
export function sparkDays(n: number, now: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(now - i * 86_400_000).toISOString());
  return out;
}

export type GlobeC = {
  id: string;
  name: string;
  code: string;
  n: number;
  v: number;
  r: number;
  links: string[];
  url: string | null;
  mk: MiniMarket[];
};

/** Countries for the globe and its card: atlas id, links via shared markets, top markets. */
export function globeCountries(ix: DeskIndex, topMarkets = 3): GlobeC[] {
  const byCountry = new Map<string, DeskMarket[]>();
  for (const m of ix.desk.markets) for (const id of m.countryIds) byCountry.set(id, [...(byCountry.get(id) ?? []), m]);
  return ix.desk.countries
    .filter((c): c is typeof c & { id: string } => !!c.id)
    .map((c) => {
      const ms = (byCountry.get(c.id) ?? []).sort((a, b) => b.vol24h - a.vol24h);
      const links = [...new Set(ms.flatMap((m) => m.countryIds))].filter((x) => x !== c.id).slice(0, 8);
      return {
        id: c.id,
        name: c.en,
        code: c.iso2,
        n: c.marketCount,
        v: c.vol24h,
        r: c.risk,
        links,
        url: c.topicSlug ? `/topic/${c.topicSlug}` : null,
        mk: ms.slice(0, topMarkets).map(mini),
      };
    });
}

/**
 * The popup in the extension mock answers its mock article ("Israel and Iran
 * trade strikes as ceasefire talks stall") with today's real markets: the
 * most traded ones that involve both countries, then either. The match
 * scores are illustrative, as in the design.
 */
export function finderRows(ix: DeskIndex) {
  const both = (m: DeskMarket) => m.countryIds.includes("376") && m.countryIds.includes("364");
  const either = (m: DeskMarket) => m.countryIds.includes("376") || m.countryIds.includes("364");
  const byVol = [...ix.desk.markets].sort((a, b) => b.vol24h - a.vol24h);
  const picks = [...byVol.filter(both), ...byVol.filter((m) => either(m) && !both(m))].slice(0, 3);
  const match = [96, 88, 71];
  return picks.map((m, i) => ({ id: m.id, q: m.title, p: m.yes, chg: m.chg, url: marketUrl(m.slug), codes: codes(m.iso2, 2), match: match[i] }));
}
