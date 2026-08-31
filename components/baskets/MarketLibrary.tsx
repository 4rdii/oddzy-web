"use client";

import { useState } from "react";
import { useLocale } from "@/components/app/LocaleProvider";
import { localized, pct } from "@/lib/format";
import { groupByKind } from "@/lib/market-kinds";
import type { EventMarket, MarketEvent } from "@/lib/api";

/**
 * The builder's market picker, rendered the way the app renders a fixture.
 *
 * A flat market list does not work here and never did. "Spread: Senegal (-3.5)"
 * means nothing on its own, and a single football fixture can carry 30+
 * markets, so a flat list of a league is a wall of near-identical rows with the
 * moneyline buried somewhere inside it. Grouping by event is what makes a
 * basket buildable: you find the GAME, then pick the side.
 *
 * Same three tiers as EventCard, deliberately — fixture name and kick-off, the
 * moneyline, then derivatives collapsed behind a toggle and split into their
 * subcategories. Someone who has used the app should not have to learn a second
 * way of reading the same data.
 */

export function MarketLibrary({
  events,
  pickedSlugs,
  full,
  onAdd,
}: {
  events: MarketEvent[];
  pickedSlugs: Set<string>;
  /** Basket is at its leg cap — every add button goes disabled, not hidden. */
  full: boolean;
  onAdd: (m: EventMarket) => void;
}) {
  return (
    <div className="space-y-3">
      {events.map((ev) => (
        <EventGroup
          key={ev.id}
          event={ev}
          pickedSlugs={pickedSlugs}
          full={full}
          onAdd={onAdd}
        />
      ))}
    </div>
  );
}

function EventGroup({
  event,
  pickedSlugs,
  full,
  onAdd,
}: {
  event: MarketEvent;
  pickedSlugs: Set<string>;
  full: boolean;
  onAdd: (m: EventMarket) => void;
}) {
  const { t, locale } = useLocale();
  const [showExtra, setShowExtra] = useState(false);
  const isMatch = event.kind === "match";

  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-[14px] leading-snug font-bold text-[var(--ink)]">
          {localized(locale, event.title, event.title_fa)}
        </h3>
        {event.market_count > 1 && (
          <span dir="ltr" className="shrink-0 font-mono text-[10px] text-[var(--faint)]">
            {event.market_count}
          </span>
        )}
      </header>

      {isMatch && event.starts_at && (
        <p dir="ltr" className="mt-1 font-mono text-[10px] tracking-[0.05em] text-[var(--faint)]">
          {kickoff(event.starts_at, locale)}
        </p>
      )}

      {event.main.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {event.main.map((m) => (
            <PickRow
              key={m.id}
              market={m}
              picked={pickedSlugs.has(m.slug)}
              full={full}
              onAdd={onAdd}
            />
          ))}
        </div>
      )}

      {event.extra.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowExtra((v) => !v)}
            aria-expanded={showExtra}
            className="mt-3 flex min-h-[34px] w-full items-center justify-between rounded-lg px-1 font-mono text-[11px] text-[var(--mute)]"
          >
            <span>
              {showExtra ? t.app.event.hide : t.app.event.extra} ·{" "}
              <span dir="ltr">{event.extra.length}</span>
            </span>
            <span aria-hidden>{showExtra ? "▴" : "▾"}</span>
          </button>

          {/* A fixture can carry 20+ totals alone, so opening this must not dump
              every row at once — same subcategory split the bot and the app use. */}
          {showExtra && (
            <div className="mt-1 flex flex-col gap-3">
              {groupByKind(event.extra).map((group) => (
                <div key={group.key}>
                  <p className="mb-1 font-mono text-[10px] tracking-[0.04em] text-[var(--faint)]">
                    {(t.app.kinds as Record<string, string>)[group.key] ?? group.label}
                  </p>
                  <div className="space-y-1.5">
                    {group.markets.map((m) => (
                      <PickRow
                        key={m.id}
                        market={m}
                        picked={pickedSlugs.has(m.slug)}
                        full={full}
                        onAdd={onAdd}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </article>
  );
}

/** One addable market: label, YES price, and the add affordance. */
function PickRow({
  market: m,
  picked,
  full,
  onAdd,
}: {
  market: EventMarket;
  picked: boolean;
  full: boolean;
  onAdd: (m: EventMarket) => void;
}) {
  const { locale, t, rtl } = useLocale();
  const c = t.basketBuilder;

  return (
    <div
      draggable={!picked}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", m.slug)}
      className="flex items-center gap-2.5 rounded-xl border bg-[var(--paper)] px-2.5 py-2"
      style={{
        opacity: picked ? 0.45 : 1,
        borderColor: picked ? "var(--btn)" : "var(--line)",
      }}
    >
      <span aria-hidden className="cursor-grab text-[var(--dots)] select-none">
        ⠿
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink)]">
        {localized(locale, m.title, m.title_fa)}
      </span>
      <span
        dir="ltr"
        className="shrink-0 text-[13px] font-bold tabular-nums"
        style={{ color: "var(--bk-green)", marginInlineEnd: rtl ? 0 : undefined }}
      >
        {pct(m.probability.yes)}%
      </span>
      <button
        type="button"
        onClick={() => onAdd(m)}
        disabled={picked || full}
        aria-label={picked ? c.added : c.add}
        className="h-7 w-7 shrink-0 rounded-lg border text-[14px] font-bold disabled:cursor-not-allowed"
        style={{
          background: picked ? "var(--bk-goldtint)" : "var(--btn)",
          borderColor: picked ? "#b08d2f" : "var(--line)",
          color: picked ? "var(--bk-gold)" : "var(--text2)",
        }}
      >
        {picked ? "✓" : "+"}
      </button>
    </div>
  );
}

/**
 * Kick-off, in the reader's own zone.
 *
 * Not UTC: a server-rendered "17:30" read as hours-old to a reader in Tehran,
 * which on a fixture list makes the whole board look stale.
 */
function kickoff(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(locale === "fa" ? "fa-IR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
