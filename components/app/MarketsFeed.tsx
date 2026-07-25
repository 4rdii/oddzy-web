"use client";

import { useEffect, useState } from "react";
import type { Market } from "@/lib/api";
import type { Section } from "@/lib/taxonomy";
import { ALL_SECTION_KEY } from "@/lib/taxonomy";
import { compactUsd, pct, untilClose } from "@/lib/format";

/**
 * Markets feed — the mini app's home screen.
 *
 * Two chip rows, because the live taxonomy is genuinely two-level
 * (Group › Sub): sections on top, the selected section's leaf categories
 * below. Picking a section shows its busiest leaves; picking a leaf filters
 * the feed to that category id.
 */
export function MarketsFeed({
  sections,
  initialMarkets,
  onOpen,
}: {
  sections: Section[];
  initialMarkets: Market[];
  onOpen: (m: Market) => void;
}) {
  const [section, setSection] = useState<string>(ALL_SECTION_KEY);
  const [leaf, setLeaf] = useState<string | null>(null);
  const [markets, setMarkets] = useState<Market[]>(initialMarkets);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = sections.find((s) => s.key === section);

  useEffect(() => {
    // The unfiltered feed is server-rendered into initialMarkets, so skip the
    // redundant refetch on mount.
    if (section === ALL_SECTION_KEY && !leaf) {
      setMarkets(initialMarkets);
      setError(null);
      return;
    }

    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    // With a section but no leaf chosen, show the section as a whole by
    // querying its highest-volume leaf — the upstream filters by leaf id only.
    const category = leaf ?? active?.leaves[0]?.id;
    const url = category ? `/api/markets?category=${encodeURIComponent(category)}&limit=40` : "/api/markets?limit=40";

    fetch(url, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: { markets: Market[] }) => setMarkets(d.markets ?? []))
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError("Couldn't load markets. Pull to retry.");
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [section, leaf, active, initialMarkets]);

  return (
    <div>
      {/* Section chips */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3" role="tablist" aria-label="Market sections">
        <Chip
          active={section === ALL_SECTION_KEY}
          onClick={() => {
            setSection(ALL_SECTION_KEY);
            setLeaf(null);
          }}
        >
          All
        </Chip>
        {sections.map((s) => (
          <Chip
            key={s.key}
            active={section === s.key}
            onClick={() => {
              setSection(s.key);
              setLeaf(null);
            }}
          >
            {s.label}
          </Chip>
        ))}
      </div>

      {/* Sub-category chips for the selected section */}
      {active && active.leaves.length > 0 && (
        <div
          className="flex gap-2 overflow-x-auto px-4 pb-3"
          role="tablist"
          aria-label={`${active.label} categories`}
        >
          <SubChip active={leaf === null} onClick={() => setLeaf(null)}>
            All {active.label}
          </SubChip>
          {active.leaves.map((l) => (
            <SubChip key={l.id} active={leaf === l.id} onClick={() => setLeaf(l.id)}>
              {l.label}
              <span className="ms-1.5 font-mono text-[10px] opacity-60">{l.count}</span>
            </SubChip>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between px-4 pb-2">
        <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
          {loading ? "LOADING…" : `${markets.length} MARKETS · BY 24H VOLUME`}
        </span>
      </div>

      {error && (
        <p className="px-4 py-6 text-center text-sm text-[var(--down)]">{error}</p>
      )}

      {!error && !loading && markets.length === 0 && (
        <p className="px-4 py-10 text-center text-sm text-[var(--mute)]">
          No live markets in this category right now.
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
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`min-h-[40px] shrink-0 rounded-full border px-4 text-[13px] font-semibold whitespace-nowrap transition-colors ${
        active
          ? "border-transparent bg-[var(--ink)] text-[var(--on-ink)]"
          : "border-[var(--line)] bg-[var(--btn)] text-[var(--mute)]"
      }`}
    >
      {children}
    </button>
  );
}

function SubChip({
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
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`min-h-[32px] shrink-0 rounded-full border px-3 font-mono text-[11px] tracking-[0.02em] whitespace-nowrap transition-colors ${
        active
          ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]"
          : "border-[var(--line)] bg-transparent text-[var(--faint)]"
      }`}
    >
      {children}
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
