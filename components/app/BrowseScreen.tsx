"use client";

import { useState } from "react";
import type { Topic } from "@/lib/taxonomy";
import { childrenOf } from "@/lib/taxonomy";

/**
 * Browse — the category tab.
 *
 * A list-style drill-down over the bot's topic tree, per the design: tapping a
 * name opens that category's markets, tapping the chevron goes a level deeper.
 * Those are deliberately two different targets, so a node that both holds
 * markets and has children (Champions League: 509 markets, 2 sub-topics) can be
 * opened or explored without one action stealing the other.
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

      <p className="px-4 pb-3 text-[11px] text-[var(--faint)]">
        Tap a name to see its markets · tap › to go deeper
      </p>

      <ul className="flex flex-col gap-2 px-4">
        {rows.map((node) => {
          const hasKids = node.children.length > 0;
          return (
            <li
              key={node.id}
              className="flex items-stretch overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]"
            >
              <button
                type="button"
                onClick={() => onPick(node)}
                className="flex min-h-[56px] flex-1 items-center gap-3 px-4 text-start"
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
              </button>

              {hasKids && (
                <button
                  type="button"
                  onClick={() => setPath([...path, node])}
                  aria-label={`Open ${node.name} subcategories`}
                  className="flex w-12 shrink-0 items-center justify-center border-s border-[var(--line)] text-[18px] text-[var(--mute)]"
                >
                  ›
                </button>
              )}
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
