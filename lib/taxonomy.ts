/**
 * Navigation tree.
 *
 * Mirrors the bot's `topics` table exactly — same nodes, same nesting, same
 * order. The tree is genuinely up to four levels deep
 * (Sports > Football > Premier League > Matches; Crypto > Bitcoin > Daily), so
 * the GUI drills down rather than flattening to two rows of chips.
 *
 * An earlier version derived a two-level model from `/markets/categories`,
 * whose "parent › leaf" labels silently dropped the upper tiers — "Premier
 * League › Champion 2026-27" with no Sports and no Football above it. That is
 * why this now comes from `/topics` instead.
 */

export type Topic = {
  /** Topic slug — pass to `snapshot?category=` (matches the node + descendants). */
  id: string;
  name: string;
  name_fa: string | null;
  emoji: string | null;
  /** How the bot renders this node: section, match_list, binary_list, outcome_list. */
  layout: string;
  /** Markets attached directly to this node (0 for a pure section). */
  own_markets: number;
  /** Markets in this node and everything beneath it. */
  active_markets: number;
  children: Topic[];
};

/** A node plus the path taken to reach it, for breadcrumbs and back. */
export type TopicPath = Topic[];

/** Depth-first lookup by slug, returning the full path to the node. */
export function findPath(roots: Topic[], id: string): TopicPath | null {
  for (const node of roots) {
    if (node.id === id) return [node];
    const below = findPath(node.children, id);
    if (below) return [node, ...below];
  }
  return null;
}

/**
 * Chips to show for the current position.
 *
 * At the root that's the top-level sections; inside a node it's its children.
 * A node whose children are all leaves still drills — that is what keeps the
 * GUI aligned with the bot instead of guessing which tiers matter.
 */
export function childrenOf(roots: Topic[], path: TopicPath): Topic[] {
  if (path.length === 0) return roots;
  return path[path.length - 1].children;
}

/** Total live markets across the tree, for the "All" chip. */
export function totalMarkets(roots: Topic[]): number {
  return roots.reduce((sum, n) => sum + n.active_markets, 0);
}
