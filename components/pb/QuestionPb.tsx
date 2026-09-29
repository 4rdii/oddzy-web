"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PricePoint } from "@/lib/api";
import { PredictProvider, YesNo } from "@/components/pb/Predict";
import { fa, faMoney, faPct, pc } from "@/lib/pb";

/**
 * PB Question — a multi-outcome question («تصمیم فدرال در اکتبر؟»): the
 * market's favourite and its price history, then every outcome with yes / no.
 */

export type QuestionOption = {
  slug: string;
  label: string;
  p: number | null;
  h24: number;
  status: string;
  outcome: string | null;
  /** The outcome's own market question, for the predict sheet. */
  q: string;
};

export type QuestionPbProps = {
  crumbs: { name: string; href?: string }[];
  title: string;
  lead: string;
  settles: string | null;
  vol24: number;
  options: QuestionOption[];
  /** History of the headline market, and which option it is. */
  history: PricePoint[];
  historyLabel: string | null;
  rules: string | null;
  rulesEnglish: boolean;
  topic: { name: string; href: string } | null;
  asOf: string;
};

const RANGES = [
  ["w", "هفته", 7],
  ["m", "ماه", 30],
  ["all", "همه", Infinity],
] as const;

function path(vals: number[]): string {
  if (vals.length < 2) return "";
  return vals
    .map((v, i) => `${i ? "L" : "M"}${(600 - (i / (vals.length - 1)) * 600).toFixed(1)} ${(170 - (v / 100) * 170).toFixed(1)}`)
    .join(" ");
}

export function QuestionPb(p: QuestionPbProps) {
  const [range, setRange] = useState<(typeof RANGES)[number][0]>("m");
  const [rules, setRules] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  // ?m=<slug> from an outcome's old /market URL: scroll to and flash its row.
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("m");
    const el = m ? document.getElementById(`mk-${m}`) : null;
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    const raf = requestAnimationFrame(() => setFlash(m));
    return () => cancelAnimationFrame(raf);
  }, []);

  const live = p.options.filter((o) => o.status === "active");
  const lead = live[0] ?? p.options[0];
  const days = RANGES.find((r) => r[0] === range)![2];
  const pts = p.history.filter((h) => h.yes !== null).slice(Number.isFinite(days) ? -days : 0);
  const vals = pts.map((h) => (h.yes as number) * 100);
  const first = vals[0];
  const last = vals[vals.length - 1];
  const delta = vals.length > 1 ? Math.round(last - first) : null;

  return (
    <PredictProvider>
      <div dir="rtl" className="pb">
        <main style={{ maxWidth: 820, margin: "0 auto", padding: "24px 16px 40px", display: "flex", flexDirection: "column", gap: 22 }}>
          <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <nav aria-label="Breadcrumb" style={{ fontSize: 12, color: "var(--muted)" }}>
              {p.crumbs.map((c, i) => (
                <span key={`${c.name}-${i}`}>
                  {i > 0 && " › "}
                  {c.href ? (
                    <Link href={c.href} style={{ color: "var(--muted)" }}>
                      {c.name}
                    </Link>
                  ) : (
                    c.name
                  )}
                </span>
              ))}
            </nav>
            <h1 style={{ margin: 0, fontSize: "clamp(24px, 5vw, 32px)", fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.4 }}>{p.title}</h1>
            <p style={{ margin: 0, fontSize: 15, color: "var(--text2)", lineHeight: 1.9, textWrap: "pretty" }}>{p.lead}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                p.settles ? `تسویه: ${p.settles}` : null,
                p.vol24 > 0 ? `حجم ۲۴ ساعت ${faMoney(p.vol24)}` : null,
                `${fa(live.length || p.options.length)} گزینه`,
              ]
                .filter(Boolean)
                .map((c) => (
                  <span key={c} style={{ fontSize: 12, color: "var(--text2)", border: "1px solid var(--line)", borderRadius: 999, padding: "3px 11px" }}>
                    {c}
                  </span>
                ))}
            </div>
          </header>

          {lead && (
            <section
              style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 22, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 200 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>محتمل‌ترین از نگاه بازار</span>
                  <span style={{ fontSize: 20, fontWeight: 800 }}>{lead.label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 40, fontWeight: 900, color: "var(--gold)", lineHeight: 1 }}>{faPct(lead.p)}</span>
                  {delta !== null && delta !== 0 && p.historyLabel === lead.label && (
                    <span style={{ fontSize: 13, fontWeight: 700, color: delta > 0 ? "var(--up)" : "var(--down)" }}>
                      {delta > 0 ? "▲" : "▼"} {fa(Math.abs(delta))} در این بازه
                    </span>
                  )}
                </div>
              </div>
              {vals.length > 1 && (
                <>
                  <div style={{ position: "relative", height: 170 }}>
                    <svg viewBox="0 0 600 170" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }} aria-hidden>
                      {[42.5, 85, 127.5].map((y) => (
                        <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="var(--line)" strokeDasharray="3 5" />
                      ))}
                      <path d={path(vals)} fill="none" stroke="var(--gold)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                    </svg>
                    {[
                      [36, "۷۵٪"],
                      [79, "۵۰٪"],
                      [121, "۲۵٪"],
                    ].map(([top, l]) => (
                      <span key={l} style={{ position: "absolute", left: 0, top: top as number, fontSize: 10.5, color: "var(--faint)" }}>
                        {l}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    {p.historyLabel && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text2)" }}>
                        <span style={{ width: 14, height: 3, borderRadius: 2, background: "var(--gold)" }} />
                        {p.historyLabel}
                      </span>
                    )}
                    <div style={{ marginInlineStart: "auto", display: "flex", gap: 4, background: "var(--bg2)", borderRadius: 10, padding: 3 }}>
                      {RANGES.map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setRange(k)}
                          style={{
                            padding: "5px 11px",
                            borderRadius: 8,
                            border: "none",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            background: k === range ? "var(--card)" : "transparent",
                            color: k === range ? "var(--text)" : "var(--muted)",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>گزینه‌ها</h2>
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 18, overflow: "hidden" }}>
              {p.options.map((o, i) => {
                const v = pc(o.p) ?? 0;
                const top = i === 0 && o.status === "active";
                return (
                  <div
                    key={o.slug}
                    id={`mk-${o.slug}`}
                    className={flash === o.slug ? "pb-flash" : undefined}
                    style={{ padding: "14px 16px", borderTop: "1px solid var(--line)", marginTop: -1, display: "flex", flexDirection: "column", gap: 10 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ width: 18, fontSize: 13, color: "var(--faint)", fontWeight: 800 }}>{fa(i + 1)}</span>
                      <div style={{ flex: "1 1 200px", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{o.label}</span>
                        {o.h24 > 0 && o.status === "active" && (
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>حجم ۲۴ ساعت {faMoney(o.h24)}</span>
                        )}
                      </div>
                      {o.status === "active" ? (
                        <>
                          <span style={{ fontSize: 22, fontWeight: 900, color: top ? "var(--gold)" : "var(--text)", minWidth: 52, textAlign: "left" }}>{faPct(o.p)}</span>
                          <YesNo title={o.q} sub={p.title} slug={o.slug} p={v} prefix={o.label} showPct={false} compact />
                        </>
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 700, color: o.outcome === "YES" ? "var(--up)" : "var(--muted)" }}>
                          {o.outcome === "YES" ? "برنده" : o.outcome === "NO" ? "خیر" : "بسته شد"}
                        </span>
                      )}
                    </div>
                    {o.status === "active" && (
                      <div style={{ height: 5, background: "var(--bg2)", borderRadius: 3, overflow: "hidden", marginInlineStart: 30 }}>
                        <div style={{ height: "100%", width: `${Math.max(v, 1.5)}%`, background: top ? "var(--gold)" : "var(--line2)", borderRadius: 3 }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {p.rules && (
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
              <button
                type="button"
                aria-expanded={rules}
                onClick={() => setRules((v) => !v)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "14px 16px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text)",
                  fontSize: 14,
                  fontWeight: 700,
                  textAlign: "right",
                }}
              >
                <span style={{ flex: 1 }}>این پرسش چطور تسویه می‌شود؟</span>
                <span style={{ color: "var(--muted)", fontSize: 18 }}>{rules ? "−" : "+"}</span>
              </button>
              {/* Kept in the DOM when closed: the rules are the page's most quotable text. */}
              <div
                hidden={!rules}
                style={{ padding: "0 16px 14px", fontSize: 13.5, color: "var(--text2)", lineHeight: 1.9, whiteSpace: "pre-line" }}
                {...(p.rulesEnglish ? { lang: "en", dir: "ltr" as const } : {})}
              >
                {p.rules}
              </div>
            </div>
          )}

          {p.topic && (
            <Link
              href={p.topic.href}
              className="pb-card-link"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 16,
                padding: "14px 16px",
                color: "var(--text)",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              <span>همهٔ بازارهای {p.topic.name}</span>
              <span style={{ color: "var(--gold)" }}>←</span>
            </Link>
          )}
          <div style={{ fontSize: 11.5, color: "var(--faint)" }}>قیمت‌ها از Polymarket · {p.asOf}</div>
        </main>
      </div>
    </PredictProvider>
  );
}
