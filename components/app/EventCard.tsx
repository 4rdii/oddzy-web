"use client";

import { useState } from "react";
import type { EventMarket, Market, MarketEvent } from "@/lib/api";
import { compactUsd, pct, localized } from "@/lib/format";
import { groupByKind } from "@/lib/market-kinds";
import { useLocale } from "./LocaleProvider";

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
  const { t, locale } = useLocale();
  const [showExtra, setShowExtra] = useState(false);
  const isMatch = event.kind === "match";

  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] leading-snug font-semibold tracking-[-0.01em]">
          {localized(locale, event.title, event.title_fa)}
        </h3>
        {event.market_count > 1 && (
          <span className="shrink-0 font-mono text-[10px] text-[var(--faint)]">
            {event.market_count}
          </span>
        )}
      </header>

      {isMatch && event.starts_at && (
        <p className="mt-1 font-mono text-[10px] tracking-[0.05em] text-[var(--faint)]">
          {kickoff(event.starts_at, locale)}
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
                {sideLabel(m, t.app.event.draw, locale)}
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
              {showExtra ? t.app.event.hide : t.app.event.extra} · {event.extra.length}
            </span>
            <span aria-hidden>{showExtra ? "▴" : "▾"}</span>
          </button>

          {showExtra && (
            <div className="mt-1 flex flex-col gap-3">
              {groupByKind(event.extra).map((group) => (
                <ExtraGroup
                  key={group.key}
                  // The lib carries the English label; the dictionary is the
                  // authority for every locale, keyed by the same group key.
                  label={(t.app.kinds as Record<string, string>)[group.key] ?? group.label}
                  markets={group.markets}
                  locale={locale}
                  onOpen={onOpen}
                />
              ))}
            </div>
          )}
        </>
      )}

      <div className="mt-3 flex items-center gap-3 font-mono text-[10px] tracking-[0.04em] text-[var(--faint)]">
        <span>
          {t.app.event.vol} <span className="ltr-num">{compactUsd(event.volume_24h)}</span>
        </span>
        {event.topic && (
          <>
            <span aria-hidden>·</span>
            <span className="truncate">
              {localized(locale, event.topic.name, event.topic.name_fa)}
            </span>
          </>
        )}
      </div>
    </article>
  );
}

/**
 * One derivative subcategory (Totals, Spreads, BTTS…), collapsed by default.
 *
 * A fixture can carry 20+ totals alone, so opening "Extra markets" must not
 * dump every row at once — the bot splits these into the same subcategories.
 */
function ExtraGroup({
  label,
  markets,
  locale,
  onOpen,
}: {
  label: string;
  markets: EventMarket[];
  locale: string;
  onOpen: (m: Market) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[34px] w-full items-center justify-between rounded-lg bg-[var(--btn)] px-3 text-start"
      >
        <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--mute)] uppercase">
          {label}
        </span>
        <span className="font-mono text-[10px] text-[var(--faint)]">
          {markets.length} {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {markets.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onOpen(m)}
                className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border border-[var(--line)] px-3 text-start"
              >
                <span className="flex-1 text-[13px] leading-snug">
                  {localized(locale, m.title, m.title_fa)}
                </span>
                <span className="shrink-0 font-mono text-[13px] font-bold text-[var(--up)]">
                  {pct(m.probability.yes)}%
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * "SAT 28 JUL · 15:00" in the viewer's timezone — Jalali for Persian readers,
 * who do not navigate by Gregorian dates.
 */
function kickoff(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tag = locale === "fa" ? "fa-IR" : undefined;
  const day = d.toLocaleDateString(tag, { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });
  // Uppercase is a latin-only convention; Persian has no case and the CSS
  // already opts FA out of `uppercase`, so match that here.
  return `${locale === "fa" ? day : day.toUpperCase()} · ${time}`;
}

/**
 * Short label for a moneyline button.
 *
 * Market titles are full questions ("Will Sabah FK win on 2026-07-29?"), which
 * don't fit a third of a row. `yes_label` is the ingest-provided display label
 * where available; otherwise pull the subject out of the question.
 *
 * The Persian path can only use the translated label — the English fallbacks
 * below parse English question grammar, so on an untranslated market they would
 * emit an all-caps latin fragment into an otherwise Persian row. Better to show
 * the untruncated English label than a mangled one.
 */
function sideLabel(
  m: Market & { kind?: string | null },
  drawLabel: string,
  locale: string,
): string {
  if (m.kind === "draw") return drawLabel;
  const labels = m.outcome_labels;
  if (locale === "fa") {
    if (labels?.yes_fa) return labels.yes_fa;
    if (labels?.yes) return labels.yes;
    return m.title_fa ?? m.title;
  }
  if (labels?.yes) return labels.yes.toUpperCase();
  const win = /^Will (.+?) win\b/i.exec(m.title);
  if (win) return win[1].toUpperCase();
  return m.title.replace(/^Will /i, "").slice(0, 18).toUpperCase();
}
