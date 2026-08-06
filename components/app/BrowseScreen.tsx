"use client";

import { useState } from "react";
import type { Topic } from "@/lib/taxonomy";
import { childrenOf } from "@/lib/taxonomy";
import { useLocale } from "./LocaleProvider";

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
  const { t, tf, locale } = useLocale();
  const [path, setPath] = useState<Topic[]>([]);
  const rows = childrenOf(topics, path);
  const current = path.length > 0 ? path[path.length - 1] : null;
  // `/topics` carries both names; the Persian one is authored in the bot's
  // topics table, so a missing translation is a data gap, not a code path.
  const name = (n: Topic) => (locale === "fa" && n.name_fa ? n.name_fa : n.name);

  return (
    <div className="pb-28">
      <h1 className="px-4 py-4 text-[20px] font-bold tracking-[-0.02em]">{t.app.browse.title}</h1>

      {/* Breadcrumbs */}
      <nav className="flex flex-wrap gap-1.5 px-4 pb-3" aria-label={t.app.browse.pathLabel}>
        <Crumb active={path.length === 0} onClick={() => setPath([])}>
          {t.app.browse.all}
        </Crumb>
        {path.map((node, i) => (
          <Crumb
            key={node.id}
            active={i === path.length - 1}
            onClick={() => setPath(path.slice(0, i + 1))}
          >
            {name(node)}
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
              <span className="flex-1 text-[15px] font-semibold text-[var(--accent)]">
                {tf(t.app.browse.allMarkets, { name: name(current) })}
              </span>
              <CountPill n={current.own_markets} />
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
                    {name(node)}
                  </span>
                  {/* Only the subcategory count lives under the name now. The
                      market count moved into the trailing pill: as a second
                      mono caption it competed with the name for the same line
                      of attention while being the least useful number on the
                      row, and in Persian it rendered in a fallback face. */}
                  {hasKids && (
                    <span className="mt-0.5 block text-[12px] text-[var(--faint)]">
                      {tf(t.app.browse.subCount, { n: node.children.length })}
                    </span>
                  )}
                </span>
                <CountPill n={node.active_markets} />
                {hasKids && (
                  <span className="text-[18px] text-[var(--mute)]" aria-hidden>
                    {t.app.browse.chevron}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {rows.length === 0 && (
        <p className="px-4 py-10 text-center text-[14px] text-[var(--mute)]">
          {t.app.browse.empty}
        </p>
      )}
    </div>
  );
}

/**
 * Live market count for a row, as a trailing chip.
 *
 * Kept as a bare figure rather than "1,204 markets": the row is already a
 * category, so the noun is implied, and the number reads faster without it —
 * which matters more here than anywhere else in the app, since scanning
 * categories by size is the whole reason to look at this screen.
 */
function CountPill({ n }: { n: number }) {
  const { locale } = useLocale();
  return (
    <span className="shrink-0 rounded-full bg-[var(--btn)] px-2.5 py-1 text-[12px] font-semibold text-[var(--mute)] tabular-nums">
      {n.toLocaleString(locale === "fa" ? "fa-IR" : "en-US")}
    </span>
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
