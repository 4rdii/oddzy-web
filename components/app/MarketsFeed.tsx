"use client";

import { useEffect, useRef, useState } from "react";
import type { Market, MarketEvent } from "@/lib/api";
import type { Topic } from "@/lib/taxonomy";
import { compactUsd, pct, untilClose } from "@/lib/format";
import { EventCard } from "./EventCard";

/**
 * Markets feed.
 *
 * Three modes, in priority order:
 *  1. Search — a title query, flat results, category ignored.
 *  2. Event-grouped — for fixture-style topics (layout `match_list`), so a
 *     football match renders as one card with its moneyline and extras rather
 *     than 37 loose binaries.
 *  3. Flat — everything else.
 *
 * Category selection lives in the Browse tab; this screen shows whatever was
 * picked there, with the active filter shown as a removable pill.
 */
export function MarketsFeed({
  topic,
  initialMarkets,
  onOpen,
  onClearTopic,
  onBrowse,
}: {
  /** Active category, or null for the cross-category feed. */
  topic: Topic | null;
  initialMarkets: Market[];
  onOpen: (m: Market) => void;
  onClearTopic: () => void;
  onBrowse: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [markets, setMarkets] = useState<Market[]>(initialMarkets);
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce so a typed query is one request, not one per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 280);
    return () => clearTimeout(id);
  }, [query]);

  const searching = debounced.length > 0;
  const grouped = !searching && topic?.layout === "match_list";

  useEffect(() => {
    // Cross-category feed with no search is server-rendered already.
    if (!searching && !topic) {
      setMarkets(initialMarkets);
      setEvents([]);
      setError(null);
      setLoading(false);
      return;
    }

    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    const url = searching
      ? `/api/markets?q=${encodeURIComponent(debounced)}&limit=40`
      : grouped
        ? `/api/events?category=${encodeURIComponent(topic!.id)}&limit=25`
        : `/api/markets?category=${encodeURIComponent(topic!.id)}&limit=40`;

    fetch(url, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: { markets?: Market[]; events?: MarketEvent[] }) => {
        setMarkets(d.markets ?? []);
        setEvents(d.events ?? []);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError("Couldn't load markets.");
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [searching, debounced, grouped, topic, initialMarkets]);

  const count = grouped ? events.length : markets.length;

  return (
    <div>
      <div className="flex gap-2 px-4 pt-3">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markets"
            aria-label="Search markets"
            className="min-h-[42px] w-full rounded-xl border border-[var(--line)] bg-[var(--card)] ps-9 pe-3 text-[14px] text-[var(--ink)] placeholder:text-[var(--faint)]"
          />
          <span
            className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-[13px] text-[var(--faint)]"
            aria-hidden
          >
            ⌕
          </span>
        </div>
        <button
          type="button"
          onClick={onBrowse}
          className="min-h-[42px] shrink-0 rounded-xl border border-[var(--line)] bg-[var(--btn)] px-3.5 text-[13px] font-semibold text-[var(--mute)]"
        >
          ☰ Browse
        </button>
      </div>

      {/* Active category pill — the filter comes from Browse, so it has to be
          visible and removable from here. */}
      {topic && !searching && (
        <div className="flex items-center gap-2 px-4 pt-3">
          <span className="flex min-h-[30px] items-center gap-1.5 rounded-full border border-[var(--accent)] px-3 text-[12px] font-semibold text-[var(--accent)]">
            {topic.emoji ? `${topic.emoji} ` : ""}
            {topic.name}
            <button
              type="button"
              onClick={onClearTopic}
              aria-label={`Clear ${topic.name} filter`}
              className="ms-0.5 text-[14px] leading-none"
            >
              ×
            </button>
          </span>
        </div>
      )}

      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
          {loading
            ? "LOADING…"
            : searching
              ? `${count} RESULT${count === 1 ? "" : "S"}`
              : grouped
                ? `${count} EVENT${count === 1 ? "" : "S"} · BY KICK-OFF`
                : `${count} MARKET${count === 1 ? "" : "S"} · BY 24H VOLUME`}
        </span>
      </div>

      {error && <p className="px-4 py-6 text-center text-sm text-[var(--down)]">{error}</p>}

      {!error && !loading && count === 0 && (
        <p className="px-4 py-10 text-center text-sm text-[var(--mute)]">
          {searching ? `Nothing matches “${debounced}”.` : "No live markets here right now."}
        </p>
      )}

      <ul className="flex flex-col gap-2.5 px-4 pb-4">
        {grouped
          ? events.map((e) => (
              <li key={e.id}>
                <EventCard event={e} onOpen={onOpen} />
              </li>
            ))
          : markets.map((m) => (
              <li key={m.id}>
                <MarketCard market={m} onOpen={() => onOpen(m)} />
              </li>
            ))}
      </ul>
    </div>
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
