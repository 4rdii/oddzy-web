"use client";

import { useState } from "react";
import type { Market, MarketEvent } from "@/lib/api";
import { compactUsd, pct } from "@/lib/format";

/**
 * One event, rendered the way the bot renders a fixture: the match name and
 * kick-off, then the moneyline row, then the derivative markets collapsed
 * behind an "extra markets" toggle.
 *
 * A flat market list can't express this — "Spread: Senegal (-3.5)" means
 * nothing on its own, and a 37-market fixture would bury everything else in the
 * feed. Collapsing the extras keeps one fixture to one card.
 */
export function EventCard({
  event,
  onOpen,
}: {
  event: MarketEvent;
  onOpen: (m: Market) => void;
}) {
  const [showExtra, setShowExtra] = useState(false);
  const isMatch = event.kind === "match";

  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] leading-snug font-semibold tracking-[-0.01em]">
          {event.title}
        </h3>
        {event.market_count > 1 && (
          <span className="shrink-0 font-mono text-[10px] text-[var(--faint)]">
            {event.market_count}
          </span>
        )}
      </header>

      {isMatch && event.starts_at && (
        <p className="mt-1 font-mono text-[10px] tracking-[0.05em] text-[var(--faint)]">
          {kickoff(event.starts_at)}
        </p>
      )}

      {/* Moneyline (or the outcome list for a multi-winner). */}
      {event.main.length > 0 && (
        <div
          className={`mt-3 grid gap-2 ${
            event.main.length === 3 ? "grid-cols-3" : event.main.length === 2 ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          {event.main.slice(0, 6).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onOpen(m)}
              className="min-h-[52px] rounded-xl border border-[var(--line)] bg-[var(--btn)] px-2 py-1.5 text-start"
            >
              <span className="block truncate font-mono text-[9px] tracking-[0.04em] text-[var(--faint)]">
                {sideLabel(m)}
              </span>
              <span className="block text-[15px] font-bold text-[var(--up)]">
                {pct(m.probability.yes)}%
              </span>
            </button>
          ))}
        </div>
      )}

      {event.extra.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowExtra((v) => !v)}
            aria-expanded={showExtra}
            className="mt-3 flex min-h-[36px] w-full items-center justify-between rounded-lg px-1 font-mono text-[11px] text-[var(--mute)]"
          >
            <span>
              {showExtra ? "Hide" : "Extra markets"} · {event.extra.length}
            </span>
            <span aria-hidden>{showExtra ? "▴" : "▾"}</span>
          </button>

          {showExtra && (
            <ul className="mt-1 flex flex-col gap-1.5">
              {event.extra.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(m)}
                    className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border border-[var(--line)] px-3 text-start"
                  >
                    <span className="flex-1 text-[13px] leading-snug">{m.title}</span>
                    <span className="shrink-0 font-mono text-[13px] font-bold text-[var(--up)]">
                      {pct(m.probability.yes)}%
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="mt-3 flex items-center gap-3 font-mono text-[10px] tracking-[0.04em] text-[var(--faint)]">
        <span>VOL {compactUsd(event.volume_24h)}</span>
        {event.topic && (
          <>
            <span aria-hidden>·</span>
            <span className="truncate">{event.topic.name}</span>
          </>
        )}
      </div>
    </article>
  );
}

/** "SAT 28 JUL · 15:00" in the viewer's timezone. */
function kickoff(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = d
    .toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
    .toUpperCase();
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
}

/**
 * Short label for a moneyline button.
 *
 * Market titles are full questions ("Will Sabah FK win on 2026-07-29?"), which
 * don't fit a third of a row. `yes_label` is the ingest-provided display label
 * where available; otherwise pull the subject out of the question.
 */
function sideLabel(m: Market & { kind?: string | null }): string {
  if (m.kind === "draw") return "DRAW";
  const labels = m.outcome_labels;
  if (labels && labels[0]) return labels[0].toUpperCase();
  const win = /^Will (.+?) win\b/i.exec(m.title);
  if (win) return win[1].toUpperCase();
  return m.title.replace(/^Will /i, "").slice(0, 18).toUpperCase();
}
