"use client";

import { useState } from "react";
import type { Topic } from "@/lib/taxonomy";
import { childrenOf } from "@/lib/taxonomy";

/**
 * Browse — the category tab.
 *
 * A list-style drill-down over the bot's topic tree. One tap target per row,
 * and the row does the only thing that makes sense for that node: if it has
 * subcategories, go deeper; if it doesn't, open its markets. Splitting the row
 * into name-vs-chevron targets (the earlier design) made the common case — a
 * leaf, where both halves did the same thing — feel like a coin flip.
 *
 * A node can have both children AND its own markets (Champions League: 509
 * markets, 2 sub-topics). Drilling into it wins, and its own markets are reached
 * from the "All … markets" row at the top of the level below, so nothing becomes
 * unreachable.
 */
export function BrowseScreen({
  topics,
  onPick,
}: {
  topics: Topic[];
  /** Show this topic's markets in the feed. */
  onPick: (topic: Topic) => void;
}) {
  const [path, setPath] = useState<Topic[]>([]);
  const rows = childrenOf(topics, path);
  const current = path.length > 0 ? path[path.length - 1] : null;

  return (
    <div className="pb-28">
      <h1 className="px-4 py-4 text-[20px] font-bold tracking-[-0.02em]">Browse</h1>

      {/* Breadcrumbs */}
      <nav className="flex flex-wrap gap-1.5 px-4 pb-3" aria-label="Category path">
        <Crumb active={path.length === 0} onClick={() => setPath([])}>
          All
        </Crumb>
        {path.map((node, i) => (
          <Crumb
            key={node.id}
            active={i === path.length - 1}
            onClick={() => setPath(path.slice(0, i + 1))}
          >
            {node.name}
          </Crumb>
        ))}
      </nav>

      <ul className="flex flex-col gap-2 px-4">
        {/* The current category's OWN markets. Only meaningful once we've drilled
            in, and only when it actually holds markets of its own rather than
            just aggregating its children's. */}
        {current && current.own_markets > 0 && (
          <li className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]">
            <button
              type="button"
              onClick={() => onPick(current)}
              className="flex min-h-[56px] w-full items-center gap-3 px-4 text-start"
            >
              <span className="flex-1">
                <span className="block text-[15px] font-semibold text-[var(--accent)]">
                  All {current.name} markets
                </span>
                <span className="block font-mono text-[10px] tracking-[0.04em] text-[var(--faint)]">
                  {current.own_markets} MARKET{current.own_markets === 1 ? "" : "S"}
                </span>
              </span>
            </button>
          </li>
        )}

        {rows.map((node) => {
          const hasKids = node.children.length > 0;
          return (
            <li
              key={node.id}
              className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]"
            >
              <button
                type="button"
                onClick={() => (hasKids ? setPath([...path, node]) : onPick(node))}
                className="flex min-h-[56px] w-full items-center gap-3 px-4 text-start"
              >
                {node.emoji && (
                  <span className="text-[16px]" aria-hidden>
                    {node.emoji}
                  </span>
                )}
                <span className="flex-1">
                  <span className="block text-[15px] font-semibold text-[var(--ink)]">
                    {node.name}
                  </span>
                  <span className="block font-mono text-[10px] tracking-[0.04em] text-[var(--faint)]">
                    {node.active_markets} MARKET{node.active_markets === 1 ? "" : "S"}
                    {hasKids && ` · ${node.children.length} SUB`}
                  </span>
                </span>
                {hasKids && (
                  <span className="text-[18px] text-[var(--mute)]" aria-hidden>
                    ›
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {rows.length === 0 && (
        <p className="px-4 py-10 text-center text-[14px] text-[var(--mute)]">
          Nothing below this category.
        </p>
      )}
    </div>
  );
}

function Crumb({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[26px] rounded-full border px-2.5 text-[11px] font-semibold"
      style={{
        borderColor: active ? "var(--accent)" : "var(--line)",
        color: active ? "var(--accent)" : "var(--mute)",
      }}
    >
      {children}
    </button>
  );
}
