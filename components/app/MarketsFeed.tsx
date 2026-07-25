"use client";

import { useEffect, useState } from "react";
import type { Market } from "@/lib/api";
import type { Topic, TopicPath } from "@/lib/taxonomy";
import { childrenOf, totalMarkets } from "@/lib/taxonomy";
import { compactUsd, pct, untilClose } from "@/lib/format";

/**
 * Markets feed — the mini app's home screen.
 *
 * Navigation is a drill-down over the bot's own topic tree, which runs up to
 * four levels deep (Sports > Football > Premier League > Matches). Tapping a
 * chip descends; a breadcrumb walks back. Every level is filterable, because
 * the upstream matches a topic slug plus all of its descendants — so "Sports"
 * shows all 1,560 sports markets rather than nothing.
 */
export function MarketsFeed({
  topics,
  initialMarkets,
  onOpen,
}: {
  topics: Topic[];
  initialMarkets: Market[];
  onOpen: (m: Market) => void;
}) {
  const [path, setPath] = useState<TopicPath>([]);
  const [markets, setMarkets] = useState<Market[]>(initialMarkets);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = path.length ? path[path.length - 1] : null;
  const chips = childrenOf(topics, path);

  useEffect(() => {
    // The unfiltered feed is server-rendered, so skip the redundant refetch.
    if (!current) {
      setMarkets(initialMarkets);
      setError(null);
      setLoading(false);
      return;
    }

    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/markets?category=${encodeURIComponent(current.id)}&limit=40`, {
      signal: ctrl.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: { markets: Market[] }) => setMarkets(d.markets ?? []))
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError("Couldn't load markets.");
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [current, initialMarkets]);

  return (
    <div>
      {/* Breadcrumb — only once we've descended, so the root stays clean. */}
      {path.length > 0 && (
        <nav
          className="flex flex-wrap items-center gap-1 px-4 pt-3 font-mono text-[11px]"
          aria-label="Category path"
        >
          <button
            type="button"
            onClick={() => setPath([])}
            className="text-[var(--accent)]"
          >
            All
          </button>
          {path.map((node, i) => (
            <span key={node.id} className="flex items-center gap-1">
              <span className="text-[var(--faint)]" aria-hidden>
                ›
              </span>
              {i === path.length - 1 ? (
                <span className="font-semibold text-[var(--ink)]">{node.name}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setPath(path.slice(0, i + 1))}
                  className="text-[var(--accent)]"
                >
                  {node.name}
                </button>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Chips for the current level. */}
      <div
        className="flex gap-2 overflow-x-auto px-4 py-3"
        role="tablist"
        aria-label={current ? `${current.name} categories` : "Market categories"}
      >
        {path.length === 0 ? (
          <Chip active onClick={() => setPath([])} count={totalMarkets(topics)}>
            All
          </Chip>
        ) : (
          <Chip active={false} onClick={() => setPath(path.slice(0, -1))}>
            ← Back
          </Chip>
        )}

        {chips.map((node) => (
          <Chip
            key={node.id}
            active={false}
            count={node.active_markets}
            onClick={() => setPath([...path, node])}
          >
            {node.emoji ? `${node.emoji} ` : ""}
            {node.name}
            {node.children.length > 0 && (
              <span className="ms-1 opacity-50" aria-hidden>
                ›
              </span>
            )}
          </Chip>
        ))}
      </div>

      <div className="flex items-center justify-between px-4 pb-2">
        <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
          {loading
            ? "LOADING…"
            : `${markets.length} MARKET${markets.length === 1 ? "" : "S"} · BY 24H VOLUME`}
        </span>
      </div>

      {error && <p className="px-4 py-6 text-center text-sm text-[var(--down)]">{error}</p>}

      {!error && !loading && markets.length === 0 && (
        <p className="px-4 py-10 text-center text-sm text-[var(--mute)]">
          No live markets here right now.
        </p>
      )}

      <ul className="flex flex-col gap-2.5 px-4 pb-4">
        {markets.map((m) => (
          <li key={m.id}>
            <MarketCard market={m} onOpen={() => onOpen(m)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex min-h-[40px] shrink-0 items-center rounded-full border px-4 text-[13px] font-semibold whitespace-nowrap transition-colors ${
        active
          ? "border-transparent bg-[var(--ink)] text-[var(--on-ink)]"
          : "border-[var(--line)] bg-[var(--btn)] text-[var(--mute)]"
      }`}
    >
      {children}
      {count != null && (
        <span className="ms-1.5 font-mono text-[10px] opacity-55">{count}</span>
      )}
    </button>
  );
}

function MarketCard({ market, onOpen }: { market: Market; onOpen: () => void }) {
  const yes = pct(market.probability.yes);
  const no = 100 - yes;

  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
      <button type="button" onClick={onOpen} className="w-full text-start">
        <h3 className="text-[15px] leading-snug font-semibold tracking-[-0.01em] text-[var(--ink)]">
          {market.title}
        </h3>
      </button>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-h-[44px] flex-1 rounded-xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--up)_10%,transparent)] px-3 text-start"
          aria-label={`Buy Yes at ${yes} percent`}
        >
          <span className="block font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
            YES
          </span>
          <span className="block text-[15px] font-bold text-[var(--up)]">{yes}%</span>
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="min-h-[44px] flex-1 rounded-xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--down)_10%,transparent)] px-3 text-start"
          aria-label={`Buy No at ${no} percent`}
        >
          <span className="block font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
            NO
          </span>
          <span className="block text-[15px] font-bold text-[var(--down)]">{no}%</span>
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3 font-mono text-[10px] tracking-[0.04em] text-[var(--faint)]">
        <span>VOL {compactUsd(market.volume.h24)}</span>
        <span aria-hidden>·</span>
        <span>{untilClose(market.close_time)}</span>
        {market.category && (
          <>
            <span aria-hidden>·</span>
            <span className="truncate">{market.category.name}</span>
          </>
        )}
      </div>
    </article>
  );
}
