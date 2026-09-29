"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { Crest } from "@/components/pb/Crest";
import { MatchCard, type MatchCardData } from "@/components/pb/MatchCard";
import { PredictProvider, usePredict } from "@/components/pb/Predict";
import { fa, faPct } from "@/lib/pb";

/** PB League Hub / PB Sport Hub. Data is prepared by the server page; this owns the interactions. */

type Crumb = { name: string; href?: string };

function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" style={{ fontSize: 12, color: "var(--muted)" }}>
      {items.map((c, i) => (
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
  );
}

const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 };

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState(0);
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 760 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800 }}>پرسش‌های رایج دربارهٔ این احتمال‌ها</h2>
      {items.map((f, i) => (
        <div key={f.q} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
          <button
            type="button"
            aria-expanded={open === i}
            onClick={() => setOpen((v) => (v === i ? -1 : i))}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
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
            <span style={{ flex: 1, lineHeight: 1.7 }}>{f.q}</span>
            <span style={{ color: "var(--muted)", fontSize: 18, width: 16 }}>{open === i ? "−" : "+"}</span>
          </button>
          {/* Always in the DOM (hidden when closed) so the answers stay crawlable. */}
          <div hidden={open !== i} style={{ padding: "0 16px 14px", fontSize: 13.5, color: "var(--text2)", lineHeight: 1.9 }}>
            {f.a}
          </div>
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------- league hub

export type SpotSide = { key: "home" | "draw" | "away"; label: string; p: number | null; slug: string };

export type LeagueHubProps = {
  crumbs: Crumb[];
  league: string;
  leagueLogo: string | null;
  h1: string;
  lines: string[];
  asOf: string | null;
  next: {
    home: string;
    away: string;
    homeLogo: string | null;
    awayLogo: string | null;
    when: string;
    marketCount: number;
    href: string;
    sides: SpotSide[];
  } | null;
  days: { label: string; cards: MatchCardData[] }[];
  unit: string;
  title: { heading: string; href: string; rows: { team: string; p: number | null }[] } | null;
  faq: { q: string; a: string }[];
};

export function LeagueHubPb(p: LeagueHubProps) {
  return (
    <PredictProvider>
      <LeagueInner {...p} />
    </PredictProvider>
  );
}

function LeagueInner(p: LeagueHubProps) {
  const open = usePredict();
  const [tab, setTab] = useState<"fix" | "title">("fix");
  const n = p.next;
  const mx = n ? Math.max(...n.sides.map((s) => s.p ?? 0)) : 0;
  return (
    <div dir="rtl" className="pb">
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "24px 16px 40px", display: "flex", flexDirection: "column", gap: 28 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Crumbs items={p.crumbs} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Crest name={p.league} src={p.leagueLogo} size={34} />
            </div>
            <h1 style={{ margin: 0, fontSize: "clamp(24px, 5vw, 32px)", fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.35 }}>{p.h1}</h1>
          </div>
          {p.lines.map((l) => (
            <p key={l} style={{ margin: 0, fontSize: 15, color: "var(--text2)", lineHeight: 1.8 }}>
              {l}
            </p>
          ))}
        </header>

        {n && (
          <section
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 22,
              padding: 20,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span
                style={{
                  alignSelf: "flex-start",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--gold)",
                  background: "var(--goldbg)",
                  border: "1px solid var(--goldline)",
                  borderRadius: 999,
                  padding: "2px 10px",
                }}
              >
                بازی بعدی
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {[
                  [n.home, n.homeLogo],
                  [n.away, n.awayLogo],
                ].map(([name, logo], i) => (
                  <div key={i} style={{ display: "contents" }}>
                    {i === 1 && <span style={{ fontSize: 14, color: "var(--faint)" }}>در برابر</span>}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 72 }}>
                      <Crest name={name as string} src={logo} size={52} />
                      <span style={{ fontSize: 15, fontWeight: 800, textAlign: "center" }}>{name}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                {n.when} · {fa(n.marketCount)} بازار
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${n.sides.length}, minmax(0,1fr))`, gap: 8 }}>
                {n.sides.map((s) => {
                  const fav = s.p !== null && s.p === mx;
                  return (
                    <button
                      key={s.key + s.slug}
                      type="button"
                      className="pb-tile"
                      onClick={() =>
                        open({
                          title: `${n.home} و ${n.away}: ${s.label}؟`,
                          sub: `${p.league} · ${n.when}`,
                          outcome: s.label,
                          prob: Math.round((s.p ?? 0.5) * 100),
                          slug: s.slug,
                        })
                      }
                      style={
                        {
                          "--tint": "var(--goldbg)",
                          "--col": "var(--gold)",
                          background: "var(--bg2)",
                          border: "1px solid var(--line)",
                          borderRadius: 14,
                          padding: "12px 10px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          alignItems: "center",
                          textAlign: "center",
                          cursor: "pointer",
                          color: "var(--text)",
                          minWidth: 0,
                        } as CSSProperties
                      }
                    >
                      <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                        {s.label}
                      </span>
                      <span style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.15, color: fav ? "var(--gold)" : "var(--text)" }}>{faPct(s.p)}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 3, height: 6 }} aria-hidden>
                {n.sides.map((s) => (
                  <span
                    key={`${s.key}-bar`}
                    style={{ flex: Math.max(Math.round((s.p ?? 0) * 100), 1), background: s.p === mx ? "var(--gold)" : "var(--line2)", borderRadius: 3 }}
                  />
                ))}
              </div>
              <Link href={n.href} style={{ fontSize: 13, fontWeight: 700, alignSelf: "flex-start" }}>
                همهٔ {fa(n.marketCount)} بازار این بازی ←
              </Link>
            </div>
          </section>
        )}

        {p.title && (
          <div
            role="tablist"
            style={{
              display: "flex",
              gap: 4,
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: 4,
              alignSelf: "flex-start",
            }}
          >
            {(
              [
                ["fix", "بازی‌ها"],
                ["title", "شانس قهرمانی"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                type="button"
                onClick={() => setTab(k)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 10,
                  border: "none",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: tab === k ? "var(--goldbg)" : "transparent",
                  color: tab === k ? "var(--gold)" : "var(--muted)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Both panels stay in the DOM so every fixture link is crawlable; the tab only hides one. */}
        <div hidden={tab !== "fix"} style={{ display: tab === "fix" ? "flex" : "none", flexDirection: "column", gap: 26 }}>
          {p.days.map((d) => (
            <section key={d.label} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{d.label}</h2>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {fa(d.cards.length)} {p.unit}
                </span>
              </div>
              <div style={grid}>
                {d.cards.map((m) => (
                  <MatchCard key={m.href} m={m} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {p.title && (
          <section
            hidden={tab !== "title"}
            style={{
              display: tab === "title" ? "block" : "none",
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 20,
              overflow: "hidden",
              maxWidth: 760,
            }}
          >
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{p.title.heading}</h2>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>شانس هر تیم از نگاه بازار</span>
            </div>
            {p.title.rows.map((t, i) => {
              const v = Math.round((t.p ?? 0) * 100);
              return (
                <div key={t.team} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderTop: "1px solid var(--line)" }}>
                  <span style={{ width: 16, fontSize: 13, color: "var(--faint)", fontWeight: 700 }}>{fa(i + 1)}</span>
                  <Crest name={t.team} size={24} />
                  <span style={{ width: 120, fontSize: 14, fontWeight: 700, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.team}
                  </span>
                  <div style={{ flex: 1, height: 8, background: "var(--bg2)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(v, 1)}%`, background: i === 0 ? "var(--gold)" : "var(--line2)", borderRadius: 4 }} />
                  </div>
                  <span style={{ width: 44, textAlign: "left", fontSize: 15, fontWeight: 800, color: i === 0 ? "var(--gold)" : "var(--text)" }}>
                    {faPct(t.p)}
                  </span>
                </div>
              );
            })}
            <Link
              href={p.title.href}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 18px",
                borderTop: "1px solid var(--line)",
                background: "var(--goldbg)",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              <span>همهٔ گزینه‌ها و پیش‌بینی</span>
              <span>←</span>
            </Link>
          </section>
        )}

        <Faq items={p.faq} />
        {p.asOf && <div style={{ fontSize: 11.5, color: "var(--faint)" }}>قیمت‌ها از Polymarket · {p.asOf}</div>}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- sport hub

export type SportHubProps = {
  crumbs: Crumb[];
  h1: string;
  summary: string;
  today: MatchCardData[];
  leagues: { key: string; name: string; count: number; href: string; cards: MatchCardData[] }[];
  showWhales: boolean;
};

export function SportHubPb(p: SportHubProps) {
  const [sel, setSel] = useState("all");
  const chips = [{ key: "all", name: "همهٔ لیگ‌ها" }, ...p.leagues];
  return (
    <div dir="rtl" className="pb">
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "24px 16px 40px", display: "flex", flexDirection: "column", gap: 30 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Crumbs items={p.crumbs} />
          <h1 style={{ margin: 0, fontSize: "clamp(24px, 5vw, 32px)", fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.35 }}>{p.h1}</h1>
          <p style={{ margin: 0, fontSize: 15, color: "var(--text2)", lineHeight: 1.8 }}>{p.summary}</p>
        </header>

        {p.today.length > 0 && (
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>امروز</h2>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--up)", fontWeight: 600 }}>
                <span className="pb-pulse" /> {fa(p.today.length)} بازی
              </span>
            </div>
            <div
              className="pb-noscroll"
              style={{ display: "flex", gap: 10, overflowX: "auto", margin: "0 -16px", padding: "2px 16px 4px", scrollSnapType: "x mandatory" }}
            >
              {p.today.map((m) => (
                <div key={m.href} style={{ flex: "0 0 280px", scrollSnapAlign: "start" }}>
                  <MatchCard m={m} />
                </div>
              ))}
            </div>
          </section>
        )}

        {p.showWhales && (
          <Link
            href="/big-games"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: "var(--goldbg)",
              border: "1px solid var(--goldline)",
              borderRadius: 18,
              padding: "16px 18px",
              color: "var(--text)",
            }}
          >
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--goldink)", background: "var(--gold)", borderRadius: 6, padding: "1px 7px" }}>تازه</span>
                <span style={{ fontSize: 16, fontWeight: 800 }}>نهنگ‌ها امروز روی چه بازی‌هایی پول گذاشته‌اند؟</span>
              </div>
              <span style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.8 }}>
                پنج بازی پرمعاملهٔ امروز، بزرگ‌ترین پیش‌بینی‌ها و امتیاز سابقهٔ هر نهنگ.
              </span>
            </div>
            <span style={{ fontSize: 20, color: "var(--gold)" }}>←</span>
          </Link>
        )}

        <div
          className="pb-noscroll"
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            margin: "0 -16px",
            padding: "6px 16px",
            position: "sticky",
            top: 58,
            zIndex: 5,
            background: "var(--bg)",
          }}
        >
          {chips.map((c) => {
            const on = c.key === sel;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setSel(c.key)}
                style={{
                  flexShrink: 0,
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `1px solid ${on ? "var(--goldline)" : "var(--line)"}`,
                  background: on ? "var(--goldbg)" : "var(--card)",
                  color: on ? "var(--gold)" : "var(--text2)",
                }}
              >
                {c.name}
              </button>
            );
          })}
        </div>

        {p.leagues.map((l) => (
          <section
            key={l.key}
            hidden={sel !== "all" && sel !== l.key}
            style={{ display: sel === "all" || sel === l.key ? "flex" : "none", flexDirection: "column", gap: 12 }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, borderBottom: "1px solid var(--line)", paddingBottom: 10, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                <Link href={l.href} style={{ color: "var(--text)" }}>
                  {l.name}
                </Link>
              </h2>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{fa(l.count)} بازی پیش رو</span>
              <Link href={l.href} style={{ marginInlineStart: "auto", fontSize: 13, fontWeight: 700 }}>
                همهٔ {fa(l.count)} بازی ←
              </Link>
            </div>
            <div style={grid}>
              {l.cards.map((m) => (
                <MatchCard key={m.href} m={m} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
