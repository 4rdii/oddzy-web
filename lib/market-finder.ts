import "server-only";

import { brandFor, type Locale } from "./i18n";
import { searchMarkets, type Market } from "./api";
import { completeJson } from "./llm";

/**
 * News text -> related live markets, for the browser extension.
 *
 * Two LLM calls around a keyword search:
 *  1. extract a few distinctive ENGLISH keywords (names, countries, teams,
 *     assets) — English even for a Farsi article, because the upstream search
 *     is a substring match on English titles and only works per keyword;
 *  2. search each keyword, merge the hits by 24h volume;
 *  3. let the model keep only the genuinely related candidates (zero is a
 *     valid answer) and say why, in the reader's language.
 */

export const MAX_INPUT_CHARS = 4000;
const MAX_KEYWORDS = 6;
const PER_KEYWORD = 40;
/**
 * Kept small on purpose: the router's models reason before answering, and the
 * ranking call's latency grows with the list — 120 candidates took ~16s, 40
 * about 5-10s. The pre-sort below keeps the likeliest 40.
 */
const MAX_CANDIDATES = 40;
const MAX_MATCHES = 4;
const KEYWORD_TIMEOUT_MS = 9000;
const KEYWORD_BUDGET_MS = 11000;
const RANK_TIMEOUT_MS = 14000;
const RANK_BUDGET_MS = 16000;

export type Match = {
  slug: string;
  title: string;
  title_fa: string | null;
  url: string;
  /** Yes probability, 0-1. */
  probability: number;
  category: string | null;
  category_fa: string | null;
  why: string;
};

/** Too generic to narrow a title search — each would match hundreds of markets. */
const STOPWORDS = new Set([
  "will", "win", "the", "and", "for", "price", "market", "markets", "deal", "war", "election",
  "president", "government", "news", "world", "new", "year", "rate", "rates", "game", "match",
]);

/** Strips markup and collapses whitespace, then caps the length. */
export function cleanText(raw: string): string {
  return raw
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_INPUT_CHARS);
}

const KEYWORD_SYSTEM = `You help find prediction markets related to a news article.
Markets have short English titles such as "US-Iran Final Nuclear Deal by September 30, 2026?",
"Will the Fed decrease interest rates by 25 bps after the September 2026 meeting?",
"Will Real Madrid win on 2026-09-20?", "Will Bitcoin hit $150k in September?".
Search is a case-insensitive SUBSTRING match on those English titles, one keyword at a time.

Return ONLY JSON: {"keywords": ["..."]}
- 3 to 6 keywords, most important first, always in English even if the article is not.
- Each keyword is one distinctive word or a short proper name as it would appear in a title:
  people (surname is best: "Trump", "Powell"), countries ("Iran", "Ukraine"), organizations
  ("Fed", "NATO", "OpenAI"), teams ("Arsenal"), assets ("Bitcoin", "Oil"), events ("Oscars").
- Never generic words like "deal", "war", "price", "election", "win".
- If the text has nothing a prediction market could be about, return {"keywords": []}.`;

function rankSystem(locale: Locale): string {
  const lang = locale === "fa" ? "Persian (Farsi)" : "English";
  return `You match a news article to live prediction markets.
You get the article and a numbered list of candidate markets. Keep ONLY markets a reader of this
article would genuinely see as about the same story, people or event. Topical overlap alone is not
enough: an article about Iran nuclear talks matches a "US-Iran nuclear deal" market, not an
"Iran leadership change" market unless the article is about that. Returning none is correct when
nothing truly fits.

Answer immediately with ONLY JSON, no explanation: {"matches": [{"id": <candidate number>, "why": "<one short line>"}]}
- At most ${MAX_MATCHES}, best match first.
- "why" is under 90 characters, written in ${lang}, and names the concrete link to the article
  (e.g. "Article covers the Sept 17 FOMC decision").`;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

async function extractKeywords(text: string): Promise<string[]> {
  const out = (await completeJson({
    system: KEYWORD_SYSTEM,
    user: text,
    maxTokens: 2000,
    timeoutMs: KEYWORD_TIMEOUT_MS,
    budgetMs: KEYWORD_BUDGET_MS,
  })) as { keywords?: unknown };
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const raw of asStringArray(out.keywords)) {
    const k = raw.replace(/[%_\\"]/g, "").trim();
    const lower = k.toLowerCase();
    // 3+ chars: "US" or "UK" as a substring matches half the catalogue.
    if (k.length < 3 || k.length > 40 || STOPWORDS.has(lower) || seen.has(lower)) continue;
    seen.add(lower);
    keywords.push(k);
    if (keywords.length === MAX_KEYWORDS) break;
  }
  return keywords;
}

/**
 * "…by September 30, 2026?" and "…by December 31, 2026?" are one question to a
 * reader. Collapsing them before ranking stops one story from filling all 40
 * slots with deadline variants.
 */
function questionFamily(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b(by|before|in|on|after)\s+(end of\s+)?(\d{4}-\d{2}-\d{2}|[a-z]+\s+\d{1,2}(,\s*\d{4})?|[a-z]+(\s+\d{4})?|\d{4})\??$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function gatherCandidates(keywords: string[]): Promise<Market[]> {
  const results = await Promise.allSettled(keywords.map((k) => searchMarkets(k, PER_KEYWORD)));
  // Score = sum of the weights of the keywords a market matched, earlier
  // (more important) keywords weighing more; 24h volume breaks ties.
  const scored = new Map<string, { m: Market; score: number }>();
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const weight = keywords.length - i;
    for (const m of r.value) {
      if (!m.slug) continue;
      const e = scored.get(m.slug);
      if (e) e.score += weight;
      else scored.set(m.slug, { m, score: weight });
    }
  });
  const ordered = [...scored.values()].sort((a, b) => b.score - a.score || b.m.volume.h24 - a.m.volume.h24);
  const families = new Set<string>();
  const out: Market[] = [];
  for (const { m } of ordered) {
    const fam = questionFamily(m.title);
    if (families.has(fam)) continue;
    families.add(fam);
    out.push(m);
    if (out.length === MAX_CANDIDATES) break;
  }
  return out;
}

async function rank(text: string, candidates: Market[], locale: Locale): Promise<{ id: number; why: string }[]> {
  const list = candidates
    .map((m, i) => `${i + 1}. ${m.title}${m.category ? ` [${m.category.name}]` : ""}`)
    .join("\n");
  const out = (await completeJson({
    system: rankSystem(locale),
    user: `ARTICLE:\n${text}\n\nCANDIDATE MARKETS:\n${list}`,
    maxTokens: 3000,
    timeoutMs: RANK_TIMEOUT_MS,
    budgetMs: RANK_BUDGET_MS,
  })) as { matches?: unknown };
  if (!Array.isArray(out.matches)) return [];
  const picked: { id: number; why: string }[] = [];
  const seen = new Set<number>();
  for (const m of out.matches as { id?: unknown; why?: unknown }[]) {
    const id = Number(m?.id);
    if (!Number.isInteger(id) || id < 1 || id > candidates.length || seen.has(id)) continue;
    seen.add(id);
    picked.push({ id, why: typeof m.why === "string" ? m.why.trim().slice(0, 140) : "" });
    if (picked.length === MAX_MATCHES) break;
  }
  return picked;
}

export async function findMatches(text: string, locale: Locale): Promise<{ matches: Match[]; keywords: string[] }> {
  const keywords = await extractKeywords(text);
  if (keywords.length === 0) return { matches: [], keywords };
  const candidates = await gatherCandidates(keywords);
  if (candidates.length === 0) return { matches: [], keywords };
  const picked = await rank(text, candidates, locale);
  const site = brandFor(locale).siteUrl.replace(/\/+$/, "");
  const matches = picked.map(({ id, why }) => {
    const m = candidates[id - 1];
    return {
      slug: m.slug,
      title: m.title,
      title_fa: m.title_fa,
      url: `${site}/market/${encodeURIComponent(m.slug)}`,
      probability: m.probability.yes,
      category: m.category?.name ?? null,
      category_fa: m.category?.name_fa ?? null,
      why,
    };
  });
  return { matches, keywords };
}
