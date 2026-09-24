"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { compactUsd, pct } from "@/lib/format";

/**
 * Every market on one match, grouped into tabs — the interactive half of the
 * match page.
 *
 * Rows carry no rules text: 80+ descriptions would add ~100KB to every match
 * page for text most visitors never open. A row fetches its rules from
 * /api/markets/by-slug when it is opened.
 *
 * `?m=<slug>` (set by the redirect from an old /market/<slug> URL) opens that
 * market's tab and row and scrolls to it. Read on the client, never through
 * the page's searchParams: that would make every match page dynamic.
 */

export type BoardMarket = {
  slug: string;
  title: string;
  title_fa: string | null;
  p: number | null;
  yes: string;
  no: string;
  h24: number;
  status: string;
  outcome: string | null;
};

export type BoardGroup = { key: string; label: string; markets: BoardMarket[] };

export type BoardLabels = {
  showAll: string;
  showFewer: string;
  rulesLoading: string;
  rulesUnavailable: string;
  resolved: string;
  tradeMarket: string;
  vol24: string;
  tablist: string;
};

const COLLAPSED = 8;

export function MatchBoard({
  groups,
  labels,
  lang,
}: {
  groups: BoardGroup[];
  labels: BoardLabels;
  lang: string;
}) {
  const [tab, setTab] = useState(groups[0]?.key ?? "");
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const target = useRef<string | null>(null);

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("m");
    if (!m) return;
    const g = groups.find((x) => x.markets.some((mk) => mk.slug === m));
    if (!g) return;
    // After the first paint, so the server-rendered board hydrates as-is.
    const id = requestAnimationFrame(() => {
      target.current = m;
      setTab(g.key);
      setAll(g.markets.findIndex((mk) => mk.slug === m) >= COLLAPSED);
      setOpen(m);
    });
    return () => cancelAnimationFrame(id);
  }, [groups]);

  useEffect(() => {
    if (!target.current) return;
    document
      .getElementById(`m-${target.current}`)
      ?.scrollIntoView({ block: "center" });
    target.current = null;
  }, [open]);

  const current = groups.find((g) => g.key === tab) ?? groups[0];
  if (!current) return null;
  const rows = all ? current.markets : current.markets.slice(0, COLLAPSED);

  return (
    <div className="mt-4 flex flex-col gap-3">
      {groups.length > 1 && (
        <div
          role="tablist"
          aria-label={labels.tablist}
          className="flex gap-1 overflow-x-auto rounded-[11px] border border-[var(--segline)] bg-[var(--seg)] p-[3px]"
        >
          {groups.map((g) => {
            const selected = g.key === current.key;
            return (
              <button
                key={g.key}
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setTab(g.key);
                  setAll(false);
                  setOpen(null);
                }}
                className={`flex min-h-[40px] shrink-0 grow items-center justify-center gap-1.5 rounded-[9px] border px-3 text-[13px] font-semibold ${
                  selected
                    ? "border-[var(--segline)] bg-[var(--card)] text-[var(--ink)] shadow-sm"
                    : "border-transparent text-[var(--text2)]"
                }`}
              >
                {g.label}
                <span className="ltr-num font-mono text-[11px] text-[var(--faint)]">
                  {g.markets.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <ul className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]">
        {rows.map((m, i) => (
          <Row
            key={m.slug}
            m={m}
            first={i === 0}
            lang={lang}
            labels={labels}
            open={open === m.slug}
            onToggle={() => setOpen(open === m.slug ? null : m.slug)}
          />
        ))}
        {current.markets.length > COLLAPSED && (
          <li className="border-t border-[var(--line)]">
            <button
              onClick={() => setAll(!all)}
              className="min-h-[48px] w-full bg-[var(--paper)] px-4 text-[14px] font-semibold text-[var(--accent)]"
            >
              {all
                ? labels.showFewer
                : labels.showAll.replace(
                    "{count}",
                    String(current.markets.length),
                  )}
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

function Row({
  m,
  first,
  lang,
  labels,
  open,
  onToggle,
}: {
  m: BoardMarket;
  first: boolean;
  lang: string;
  labels: BoardLabels;
  open: boolean;
  onToggle: () => void;
}) {
  const [rules, setRules] = useState<string | null | undefined>(undefined);
  const [rulesEnglish, setRulesEnglish] = useState(false);

  useEffect(() => {
    if (!open || rules !== undefined) return;
    let live = true;
    fetch(`/api/markets/by-slug/${encodeURIComponent(m.slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          d: {
            description?: string | null;
            description_fa?: string | null;
          } | null,
        ) => {
          if (!live) return;
          const fa = lang === "fa" ? (d?.description_fa ?? null) : null;
          setRulesEnglish(lang === "fa" && !fa);
          setRules(fa ?? d?.description ?? null);
        },
      )
      .catch(() => live && setRules(null));
    return () => {
      live = false;
    };
  }, [open, rules, m.slug, lang]);

  const title = lang === "fa" && m.title_fa ? m.title_fa : m.title;
  const settled = m.status !== "active" || m.outcome !== null;
  const yesPct = m.p === null ? null : pct(m.p);

  return (
    <li
      id={`m-${m.slug}`}
      className={first ? "" : "border-t border-[var(--line)]"}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-start sm:gap-4 sm:px-[18px]"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] leading-snug font-medium">{title}</span>
          <span className="font-mono text-[11px] text-[var(--faint)]">
            <span className="ltr-num">{compactUsd(m.h24)}</span> ·{" "}
            {labels.vol24}
          </span>
        </span>
        {settled ? (
          <span className="shrink-0 rounded-[9px] border border-[var(--line)] px-2.5 py-1.5 text-[13px] font-semibold text-[var(--text2)]">
            {labels.resolved.replace(
              "{outcome}",
              m.outcome === "YES" ? m.yes : m.outcome === "NO" ? m.no : "—",
            )}
          </span>
        ) : (
          yesPct !== null && (
            <span className="flex shrink-0 flex-col gap-1 sm:flex-row sm:gap-2">
              <span className="rounded-[9px] bg-[var(--uptint)] px-2.5 py-1.5 text-[13px] font-semibold whitespace-nowrap text-[var(--up)]">
                {m.yes} <span className="ltr-num font-mono">{yesPct}%</span>
              </span>
              <span className="rounded-[9px] border border-[var(--line)] px-2.5 py-1.5 text-[13px] font-semibold whitespace-nowrap text-[var(--text2)]">
                {m.no}{" "}
                <span className="ltr-num font-mono">{100 - yesPct}%</span>
              </span>
            </span>
          )
        )}
      </button>
      {open && (
        <div className="flex flex-col items-start gap-3 px-4 pb-4 sm:px-[18px]">
          <p
            className="max-w-full text-[14px] leading-relaxed whitespace-pre-line text-[var(--text2)]"
            {...(rulesEnglish ? { lang: "en", dir: "ltr" as const } : {})}
          >
            {rules === undefined
              ? labels.rulesLoading
              : (rules ?? labels.rulesUnavailable)}
          </p>
          {!settled && (
            <Link
              href={`/app?market=${encodeURIComponent(m.slug)}`}
              className="min-h-[44px] rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[14px] font-semibold text-[var(--on-accent)]"
            >
              {labels.tradeMarket}
            </Link>
          )}
        </div>
      )}
    </li>
  );
}
