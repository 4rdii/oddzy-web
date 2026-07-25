/**
 * Derivative market groupings.
 *
 * The bot never shows a match's extras as one flat list — it splits them into
 * totals / spreads / BTTS / halftime / corners / player props, which is the
 * only way ~35 rows on a single fixture stay navigable. `markets.kind` is set
 * at ingest, so we group on that rather than parsing titles.
 *
 * Order below is the display order; anything with an unrecognised kind falls
 * into "Other markets" rather than being dropped.
 */
export const KIND_GROUPS: { key: string; label: string; kinds: string[] }[] = [
  { key: "total", label: "Totals (over/under)", kinds: ["total"] },
  { key: "spread", label: "Spreads", kinds: ["spread"] },
  { key: "btts", label: "Both teams to score", kinds: ["btts"] },
  { key: "halftime", label: "Halftime", kinds: ["halftime"] },
  { key: "corners", label: "Corners", kinds: ["corners"] },
  { key: "advance", label: "To advance", kinds: ["advance"] },
  { key: "h2h", label: "Head to head", kinds: ["h2h"] },
  { key: "prop", label: "Player props", kinds: ["prop", "player_prop", "scorer"] },
];

const KIND_TO_GROUP = new Map<string, string>();
for (const g of KIND_GROUPS) for (const k of g.kinds) KIND_TO_GROUP.set(k, g.key);

export const OTHER_GROUP = { key: "other", label: "Other markets" };

/** Split markets into ordered, non-empty groups by their ingest `kind`. */
export function groupByKind<T extends { kind: string | null }>(
  markets: T[],
): { key: string; label: string; markets: T[] }[] {
  const buckets = new Map<string, T[]>();
  for (const m of markets) {
    const key = (m.kind && KIND_TO_GROUP.get(m.kind)) ?? OTHER_GROUP.key;
    const list = buckets.get(key);
    if (list) list.push(m);
    else buckets.set(key, [m]);
  }

  const out: { key: string; label: string; markets: T[] }[] = [];
  for (const g of KIND_GROUPS) {
    const ms = buckets.get(g.key);
    if (ms?.length) out.push({ key: g.key, label: g.label, markets: ms });
  }
  const other = buckets.get(OTHER_GROUP.key);
  if (other?.length) out.push({ ...OTHER_GROUP, markets: other });
  return out;
}
