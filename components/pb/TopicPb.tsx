import Link from "next/link";
import type { ReactNode } from "react";
import type { Market } from "@/lib/api";
import { PredictProvider, YesNo } from "@/components/pb/Predict";
import { fa, faMoney, nowMs, pc } from "@/lib/pb";

/**
 * PB Topic — a non-sport topic hub («ایران: بازار چه می‌گوید»): featured
 * questions, then the topic's markets as two groups (settling soon / most
 * traded), each a card with the market's odds, a verbal read of them and
 * yes / no. Every card title links to the market's own page, which is what
 * the hub exists to pass rank to.
 */

export type TopicFeature = { href: string; kicker: string; title: string; sub: string };

function word(p: number): string {
  return p >= 95 ? "تقریباً قطعی" : p >= 65 ? "محتمل" : p >= 35 ? "نامعلوم" : p >= 6 ? "بعید" : "بسیار بعید";
}

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - nowMs()) / 86_400_000));
}

function Card({ m, title, meta, sub }: { m: Market; title: string; meta: string; sub: string }) {
  const p = pc(m.probability?.yes) ?? 0;
  const c = p >= 50 ? "var(--gold)" : "var(--text)";
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <Link href={`/market/${m.slug}`} style={{ flex: 1, fontSize: 14.5, fontWeight: 600, lineHeight: 1.75, textWrap: "pretty", color: "var(--text)" }}>
          {title}
        </Link>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, flexShrink: 0 }}>
          <span style={{ fontSize: 24, fontWeight: 900, color: c, lineHeight: 1.2 }}>{fa(p)}٪</span>
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{word(p)}</span>
        </div>
      </div>
      <div style={{ height: 4, background: "var(--bg2)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.max(p, 2)}%`, background: c, borderRadius: 2 }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto" }}>
        <span style={{ fontSize: 12, color: "var(--muted)", flex: 1 }}>{meta}</span>
        <YesNo title={title} sub={sub} slug={m.slug} p={p} showPct={false} compact />
      </div>
    </div>
  );
}

export function TopicPb({
  h1,
  lead,
  topicName,
  features,
  markets,
  guides,
}: {
  h1: string;
  lead: string;
  topicName: string;
  features: TopicFeature[];
  markets: Market[];
  guides: ReactNode;
}) {
  const sub = `${topicName} · بازار پیش‌بینی`;
  const title = (m: Market) => m.title_fa ?? m.title;
  const dated = markets
    .filter((m) => m.close_time && new Date(m.close_time).getTime() > nowMs())
    .sort((a, b) => String(a.close_time).localeCompare(String(b.close_time)));
  const soon = dated.filter((m) => daysLeft(m.close_time!) <= 30).slice(0, 8);
  const taken = new Set(soon.map((m) => m.slug));
  const busy = markets
    .filter((m) => !taken.has(m.slug))
    .sort((a, b) => (b.volume.h24 ?? 0) - (a.volume.h24 ?? 0))
    .slice(0, 12);
  const groups = [
    {
      title: "به‌زودی تسویه می‌شوند",
      sub: "به ترتیب نزدیک‌ترین مهلت",
      items: soon.map((m) => ({ m, meta: `${fa(daysLeft(m.close_time!))} روز مانده` })),
    },
    {
      title: soon.length ? "پرمعامله‌ترین‌ها" : "بازارها",
      sub: "بیشترین پول در ۲۴ ساعت گذشته",
      items: busy.map((m) => ({ m, meta: m.volume.h24 ? `حجم ۲۴ ساعت ${faMoney(m.volume.h24)}` : "" })),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <PredictProvider>
      <div dir="rtl" className="pb">
        <main style={{ maxWidth: 1120, margin: "0 auto", padding: "24px 16px 40px", display: "flex", flexDirection: "column", gap: 28 }}>
          <header style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 720 }}>
            <nav aria-label="Breadcrumb" style={{ fontSize: 12, color: "var(--muted)" }}>
              <Link href="/" style={{ color: "var(--muted)" }}>
                خانه
              </Link>{" "}
              › {topicName}
            </nav>
            <h1 style={{ margin: 0, fontSize: "clamp(24px, 5vw, 32px)", fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.35 }}>{h1}</h1>
            <p style={{ margin: 0, fontSize: 15, color: "var(--text2)", lineHeight: 1.9, textWrap: "pretty" }}>{lead}</p>
          </header>

          {features.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: "var(--card)",
                border: "1px solid var(--goldline)",
                borderRadius: 18,
                padding: "16px 18px",
                color: "var(--text)",
              }}
            >
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <span
                  style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 700, color: "var(--gold)", background: "var(--goldbg)", borderRadius: 6, padding: "1px 8px" }}
                >
                  {f.kicker}
                </span>
                <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.6 }}>{f.title}</span>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{f.sub}</span>
              </div>
              <span style={{ fontSize: 20, color: "var(--gold)" }}>←</span>
            </Link>
          ))}

          {groups.map((g) => (
            <section key={g.title} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, borderBottom: "1px solid var(--line)", paddingBottom: 10, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{g.title}</h2>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{g.sub}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
                {g.items.map(({ m, meta }) => (
                  <Card key={m.slug} m={m} title={title(m)} meta={meta} sub={sub} />
                ))}
              </div>
            </section>
          ))}

          {guides}
          <div style={{ fontSize: 11.5, color: "var(--faint)" }}>قیمت‌ها از Polymarket · به‌روزرسانی در طول روز</div>
        </main>
      </div>
    </PredictProvider>
  );
}
