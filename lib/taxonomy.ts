/**
 * Category taxonomy.
 *
 * The market-data API returns a FLAT list of leaf categories whose `name` is
 * already two-level: "Politics › Global Elections", "Bitcoin › Daily". That
 * gives us a natural sub-category axis, but the raw top halves are uneven for
 * navigation — Bitcoin/Ethereum/Solana/XRP each surface as their own group,
 * and every football league gets one too, so a flat chip row would be ~17 chips
 * with no hierarchy.
 *
 * So we fold API groups into a curated set of SECTIONS (the top chip row) and
 * let the API groups/leaves become the sub-chips. Anything the map doesn't know
 * about still shows up — it becomes its own section — so a category added to
 * the indexer later appears in the UI without a deploy here.
 */

export type ApiCategory = {
  id: string;
  name: string;
  active_markets: number;
};

/** A leaf category as the UI consumes it. */
export type Leaf = {
  /** API category id — what you pass to `snapshot?category=`. */
  id: string;
  /** "Global Elections" — the part after "›". */
  label: string;
  /** "Politics" — the part before "›", as the API spells it. */
  group: string;
  count: number;
};

export type Section = {
  /** Stable slug used in the URL / chip state. */
  key: string;
  label: string;
  count: number;
  /** Sub-chips. Grouped by API group when a section spans several. */
  leaves: Leaf[];
};

/**
 * API group name → section key. Groups absent here become their own section
 * (see `sectionForGroup`), which is the "new category appears automatically"
 * escape hatch.
 */
const GROUP_TO_SECTION: Record<string, string> = {
  Bitcoin: "crypto",
  Ethereum: "crypto",
  Solana: "crypto",
  XRP: "crypto",
  Crypto: "crypto",

  "Champions League": "football",
  Football: "football",
  "Premier League": "football",
  "La Liga": "football",
  "Serie A": "football",
  Bundesliga: "football",
  "Ligue 1": "football",

  Sports: "sports",
  "Combat Sports": "sports",

  Politics: "politics",
  "US Midterms 2026": "politics",
  Iran: "politics",

  Economy: "economy",
};

/** Display labels + ordering for the curated sections. */
const SECTION_META: { key: string; label: string }[] = [
  { key: "crypto", label: "Crypto" },
  { key: "football", label: "Football" },
  { key: "sports", label: "Sports" },
  { key: "politics", label: "Politics" },
  { key: "economy", label: "Economy" },
];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function splitName(name: string): { group: string; label: string } {
  // The API uses "›" (U+203A). Fall back to the whole string when a category
  // has no sub-level, so `label` is never empty.
  const [group, ...rest] = name.split("›").map((p) => p.trim());
  const label = rest.join(" › ");
  return { group, label: label || group };
}

function sectionForGroup(group: string): { key: string; label: string } {
  const mapped = GROUP_TO_SECTION[group];
  if (mapped) {
    const meta = SECTION_META.find((s) => s.key === mapped);
    return { key: mapped, label: meta?.label ?? group };
  }
  return { key: slugify(group), label: group };
}

/**
 * Build the two-level chip model from the API's flat category list.
 * Sections are ordered by the curated list first, then by market count.
 * Leaves are ordered by count so the busiest sub-category leads.
 */
export function buildSections(categories: ApiCategory[]): Section[] {
  const bySection = new Map<string, Section>();

  for (const c of categories) {
    if (!c.active_markets) continue;
    const { group, label } = splitName(c.name);
    const sec = sectionForGroup(group);

    let entry = bySection.get(sec.key);
    if (!entry) {
      entry = { key: sec.key, label: sec.label, count: 0, leaves: [] };
      bySection.set(sec.key, entry);
    }
    entry.count += c.active_markets;
    entry.leaves.push({
      id: c.id,
      // When a section folds several API groups together (Crypto ← Bitcoin,
      // Ethereum, …) the bare sub-label "Daily" is ambiguous, so qualify it
      // with the group. Within a single-group section the sub-label stands
      // alone — "Inflation", not "Economy Inflation".
      label,
      group,
      count: c.active_markets,
    });
  }

  const sections = [...bySection.values()];

  for (const s of sections) {
    // Qualify a leaf with its group ONLY when the bare label collides inside
    // this section: "Daily" appears under Bitcoin, Ethereum, Solana and XRP, so
    // those become "Bitcoin · Daily". "NBA" is unique within Sports and reads
    // worse as "Sports · NBA", so it stays bare.
    const seen = new Map<string, number>();
    for (const leaf of s.leaves) {
      seen.set(leaf.label, (seen.get(leaf.label) ?? 0) + 1);
    }
    for (const leaf of s.leaves) {
      if ((seen.get(leaf.label) ?? 0) > 1 && leaf.label !== leaf.group) {
        leaf.label = `${leaf.group} · ${leaf.label}`;
      }
    }
    s.leaves.sort((a, b) => b.count - a.count);
  }

  const order = new Map(SECTION_META.map((s, i) => [s.key, i]));
  sections.sort((a, b) => {
    const ia = order.get(a.key) ?? Infinity;
    const ib = order.get(b.key) ?? Infinity;
    if (ia !== ib) return ia - ib;
    return b.count - a.count;
  });

  return sections;
}

/** The "All" pseudo-section that leads the top chip row. */
export const ALL_SECTION_KEY = "all";
