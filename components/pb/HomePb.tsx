"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { BRANDS } from "@/lib/i18n";
import { botLink } from "@/lib/telegram";
import { Crest } from "@/components/pb/Crest";
import { Faq } from "@/components/pb/HubViews";
import { PredictProvider, usePredict } from "@/components/pb/Predict";
import { useNow } from "@/components/pb/useNow";
import { fa, faMoney, faPct, pc, SIDE_COLOR } from "@/lib/pb";
import { HOME_FAQ } from "@/components/pb/homeFaq";

/** PB Home — the PolyBaaz landing page. Data is prepared by app/[lang]/page.tsx. */

export type HomeHero = {
  href: string;
  league: string;
  when: string;
  home: { name: string; logo: string | null };
  away: { name: string; logo: string | null };
  sides: { key: "home" | "draw" | "away"; label: string; p: number | null; slug: string }[];
  vol: number | null;
  marketCount: number;
};

export type HomeMarket = { slug: string; href: string; q: string; p: number | null; vol: number };
export type HomeCat = { key: string; label: string; color: string; markets: HomeMarket[] };
export type HomeWhale = { name: string; score: number | null; color: string; bet: string; amt: string };
export type HomeBasket = { href: string; title: string; legs: { label: string; pct: number }[]; mult: number | null };


const TG_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#229ED9" aria-hidden>
    <path d="M21.9 3.3 18.6 19c-.25 1.1-.9 1.37-1.82.85l-5.03-3.7-2.43 2.33c-.27.27-.5.5-1.01.5l.36-5.12 9.32-8.42c.4-.36-.09-.56-.63-.2L5.84 12.5.88 10.95c-1.08-.34-1.1-1.08.23-1.6L20.5 1.87c.9-.33 1.69.2 1.4 1.43Z" />
  </svg>
);

function Ctas({ big }: { big?: boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: big ? "center" : undefined }}>
      <Link
        href="/app"
        className="pb-gold-btn"
        style={{ fontWeight: 900, fontSize: 16, padding: big ? "14px 26px" : "15px 28px", borderRadius: 15, boxShadow: big ? undefined : "0 12px 30px -14px var(--gold)" }}
      >
        شروع پیش‌بینی در وب
      </Link>
      <a
        href={botLink(undefined, BRANDS.fa.tgBot)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          background: "rgba(34,158,217,.12)",
          border: "1px solid rgba(34,158,217,.35)",
          color: "#229ED9",
          fontWeight: 700,
          fontSize: 14,
          padding: "10px 16px",
          borderRadius: 999,
        }}
      >
        {TG_ICON}یا در ربات تلگرام
      </a>
    </div>
  );
}

export function HomePb(p: { hero: HomeHero | null; ticks: string[]; cats: HomeCat[]; whales: HomeWhale[]; basket: HomeBasket | null }) {
  return (
    <PredictProvider>
      <HomeInner {...p} />
    </PredictProvider>
  );
}

function HomeInner({ hero, ticks, cats, whales, basket }: { hero: HomeHero | null; ticks: string[]; cats: HomeCat[]; whales: HomeWhale[]; basket: HomeBasket | null }) {
  const open = usePredict();
  const [cat, setCat] = useState(cats[0]?.key ?? "all");
  const now4 = useNow(4000);
  const tick = ticks.length && now4 !== null ? ticks[Math.floor(now4 / 4000) % ticks.length] : ticks[0];
  const shown = (cats.find((c) => c.key === cat) ?? cats[0])?.markets.slice(0, 6) ?? [];
  const catOf = (slug: string) => cats.find((c) => c.key !== "all" && c.markets.some((m) => m.slug === slug));
  const mx = hero ? Math.max(...hero.sides.map((s) => s.p ?? 0)) : 0;

  return (
    <div dir="rtl" className="pb">
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid var(--line)",
          background: "radial-gradient(70% 90% at 85% 0%, var(--goldbg), transparent 70%)",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 16px 44px", display: "flex", flexWrap: "wrap", gap: 36, alignItems: "center" }}>
          <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
            <span
              style={{
                alignSelf: "flex-start",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--text2)",
                border: "1px solid var(--line)",
                background: "var(--card)",
                borderRadius: 999,
                padding: "4px 12px",
              }}
            >
              <span className="pb-pulse" /> بازارهای Polymarket، به فارسی
            </span>
            <h1 style={{ margin: 0, fontSize: "clamp(30px, 6vw, 44px)", fontWeight: 900, lineHeight: 1.3, letterSpacing: -1, textWrap: "balance" }}>
              روی آنچه فکر می‌کنید <span style={{ color: "var(--gold)" }}>اتفاق می‌افتد</span> پیش‌بینی کنید
            </h1>
            <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.95, color: "var(--text2)", maxWidth: 520, textWrap: "pretty" }}>
              فوتبال، سیاست، اقتصاد و کریپتو. هر درصد، احتمالی است که آدم‌ها با پول واقعی رویش توافق کرده‌اند. اگر درست بگویید، هر سهم یک دلار می‌شود.
            </p>
            <Ctas />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px", fontSize: 12.5, color: "var(--muted)" }}>
              <span>✓ کلید کیف پول نزد خودتان</span>
              <span>✓ شروع از ۱ دلار</span>
              <span>✓ تسویه با نتیجهٔ رسمی</span>
            </div>
          </div>

          {hero && (
            <div style={{ flex: "1 1 360px", minWidth: 0, maxWidth: 460, marginInline: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--line)",
                  borderRadius: 22,
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  boxShadow: "0 30px 60px -30px rgba(0,0,0,.6)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--up)", fontWeight: 700 }}>
                    <span className="pb-pulse" /> بازی داغ امروز
                  </span>
                  <span style={{ color: "var(--faint)" }}>·</span>
                  <span>
                    {hero.league} · {hero.when}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8 }}>
                  {[hero.home, null, hero.away].map((t, i) =>
                    t ? (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <Crest name={t.name} src={t.logo} size={48} />
                        <span style={{ fontSize: 16, fontWeight: 800, textAlign: "center" }}>{t.name}</span>
                      </div>
                    ) : (
                      <span key={i} style={{ fontSize: 13, color: "var(--faint)" }}>
                        در برابر
                      </span>
                    ),
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${hero.sides.length}, minmax(0,1fr))`, gap: 6 }}>
                  {hero.sides.map((s) => {
                    const col = SIDE_COLOR[s.key];
                    const fav = s.p !== null && s.p === mx;
                    return (
                      <button
                        key={s.key + s.slug}
                        type="button"
                        className="pb-tile"
                        onClick={() =>
                          open({
                            title: `${hero.home.name} و ${hero.away.name}: ${s.label}؟`,
                            sub: `${hero.league} · ${hero.when}`,
                            outcome: s.label,
                            prob: pc(s.p) ?? 50,
                            slug: s.slug,
                          })
                        }
                        style={
                          {
                            "--tint": col.bg,
                            "--col": col.c,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 2,
                            padding: "12px 6px",
                            borderRadius: 14,
                            border: `1px solid ${fav ? col.line : "var(--line)"}`,
                            background: fav ? col.bg : "var(--bg2)",
                            color: "var(--text)",
                            cursor: "pointer",
                            minWidth: 0,
                          } as CSSProperties
                        }
                      >
                        <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{s.label}</span>
                        <span style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.2, color: s.key === "draw" ? "var(--text)" : col.c }}>{faPct(s.p)}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 3, height: 6 }} aria-hidden>
                  {hero.sides.map((s) => (
                    <span key={`${s.key}-bar`} style={{ flex: Math.max(pc(s.p) ?? 0, 1), background: SIDE_COLOR[s.key].c, borderRadius: 3 }} />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--muted)" }}>
                  <span>{hero.vol ? `حجم ۲۴ ساعت ${faMoney(hero.vol)}` : ""}</span>
                  <Link href={hero.href} style={{ fontWeight: 700 }}>
                    {fa(hero.marketCount)} بازار این بازی ←
                  </Link>
                </div>
              </div>
              {tick && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text2)", padding: "0 6px", minHeight: 24 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gold)", flexShrink: 0 }} />
                  <span key={tick} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", animation: "pbup .35s ease-out" }}>
                    {tick}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 16px 40px", display: "flex", flexDirection: "column", gap: 40 }}>
        {cats.length > 0 && (
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>داغ‌ترین بازارها</h2>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>بیشترین پول در ۲۴ ساعت گذشته</span>
            </div>
            <div className="pb-noscroll" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -16px", padding: "0 16px" }}>
              {cats.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCat(c.key)}
                  style={{
                    flexShrink: 0,
                    padding: "8px 16px",
                    borderRadius: 999,
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    border: `1px solid ${c.key === cat ? "var(--goldline)" : "var(--line)"}`,
                    background: c.key === cat ? "var(--goldbg)" : "var(--card)",
                    color: c.key === cat ? "var(--gold)" : "var(--text2)",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 10 }}>
              {shown.map((m) => {
                const y = pc(m.p) ?? 0;
                const c = catOf(m.slug) ?? cats.find((x) => x.key === cat);
                const col = y >= 50 ? "var(--up)" : "var(--text)";
                const sub = c && c.key !== "all" ? c.label : "بازار پیش‌بینی";
                return (
                  <div
                    key={m.slug}
                    className="pb-card-link"
                    style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 18, padding: "15px 16px", display: "flex", flexDirection: "column", gap: 12 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--muted)" }}>
                      {c && c.key !== "all" && (
                        <>
                          <span style={{ fontWeight: 700, color: c.color }}>{c.label}</span>
                          <span style={{ color: "var(--faint)" }}>·</span>
                        </>
                      )}
                      <span>حجم {faMoney(m.vol)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      <Link href={m.href} style={{ flex: 1, fontSize: 15, fontWeight: 700, lineHeight: 1.75, color: "var(--text)", textWrap: "pretty" }}>
                        {m.q}
                      </Link>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                        <span style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.15, color: col }}>{fa(y)}٪</span>
                        <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>شانس بله</span>
                      </div>
                    </div>
                    <div style={{ height: 4, background: "var(--bg2)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.max(y, 2)}%`, background: col, borderRadius: 2 }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: "auto" }}>
                      <button
                        type="button"
                        className="pb-yes"
                        onClick={() => open({ title: m.q, sub, outcome: "بله", prob: y, slug: m.slug })}
                        style={{ padding: 9, borderRadius: 11, border: "1px solid transparent", background: "var(--upbg)", color: "var(--up)", fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}
                      >
                        بله {fa(y)}٪
                      </button>
                      <button
                        type="button"
                        onClick={() => open({ title: m.q, sub, outcome: "خیر", prob: 100 - y, slug: m.slug })}
                        style={{ padding: 9, borderRadius: 11, border: "1px solid transparent", background: "var(--downbg)", color: "var(--down)", fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}
                      >
                        خیر {fa(100 - y)}٪
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <Link
          href="/big-games"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 18,
            alignItems: "center",
            background: "var(--card)",
            border: "1px solid var(--goldline)",
            borderRadius: 22,
            padding: 20,
            color: "var(--text)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 200 120"
            style={{ position: "absolute", left: "50%", top: "50%", width: "min(460px, 90%)", height: "auto", opacity: 0.07, pointerEvents: "none", color: "var(--text)", transform: "translate(-50%,-50%) scaleX(-1)" }}
          >
            <path fill="currentColor" d="M20 72C20 44 58 32 98 33c30 1 48 13 58 27l22-20c6-4 14 0 10 8l-16 18 18 14c4 8-4 12-10 8l-22-12c-10 18-36 30-70 30C46 106 20 94 20 72Z" />
            <circle cx="46" cy="64" r="4" fill="var(--card)" />
            <path d="M30 84c26 12 70 12 104-2" fill="none" stroke="var(--card)" strokeWidth="3" strokeLinecap="round" />
            <path d="M60 30V14M60 16c-6-8-14-8-18-4M60 16c6-8 14-8 18-4" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
          <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
            <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 800, color: "var(--goldink)", background: "var(--gold)", borderRadius: 6, padding: "1px 8px" }}>تازه</span>
            <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.5 }}>نهنگ‌ها امروز روی چه بازی‌هایی پول گذاشته‌اند؟</span>
            <span style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.8 }}>بزرگ‌ترین پیش‌بینی‌های پیش از بازی، همراه با امتیاز سابقهٔ واقعی هر معامله‌گر.</span>
          </div>
          {whales.length > 0 && (
            <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 8, position: "relative" }}>
              {whales.map((w) => (
                <div
                  key={w.name + w.amt}
                  style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 12, padding: "9px 12px", fontSize: 13 }}
                >
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      border: `2.5px solid ${w.color}`,
                      color: w.color,
                      fontWeight: 900,
                      fontSize: 12,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {w.score === null ? "—" : fa(w.score)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <span dir="ltr" style={{ fontWeight: 800, textAlign: "right" }}>
                      {w.name}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.bet}</span>
                  </div>
                  <span style={{ fontWeight: 800, flexShrink: 0 }}>{w.amt}</span>
                </div>
              ))}
            </div>
          )}
        </Link>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          <UpDownTile />
          {basket && <BasketTile b={basket} />}
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>آموزش کار با پلی‌باز</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {[
              ["یک پرسش انتخاب کنید", "«اسپانیا می‌برد؟» قیمت ۸۱ سنت یعنی بازار ۸۱٪ شانس می‌دهد."],
              ["بله یا خیر بخرید", "از ۱ دلار شروع کنید. تا پیش از پایان بازار هر وقت خواستید می‌فروشید."],
              ["درست گفتید؟ ۱ دلار برای هر سهم", "بعد از اعلام نتیجهٔ رسمی، هر سهم درست یک دلار تسویه می‌شود."],
            ].map(([h, d], i) => (
              <div key={h} style={{ borderTop: `2px solid ${i === 0 ? "var(--gold)" : "var(--line2)"}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: i === 0 ? "var(--gold)" : "var(--text2)", lineHeight: 1 }}>{fa(i + 1)}</span>
                <span style={{ fontSize: 16, fontWeight: 800 }}>{h}</span>
                <span style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.9 }}>{d}</span>
              </div>
            ))}
          </div>
        </section>

        <div style={{ maxWidth: 760, width: "100%", marginInline: "auto" }}>
          <Faq items={HOME_FAQ} heading="پرسش‌های رایج" centered />
        </div>

        <section
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 22,
            padding: "26px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            textAlign: "center",
            backgroundImage: "radial-gradient(80% 120% at 50% 0%, var(--goldbg), transparent 70%)",
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.5 }}>نظرتان دربارهٔ امشب چیست؟</span>
          <Ctas big />
        </section>
      </main>
    </div>
  );
}

type Window = { asset: string; up_price: number | null; down_price: number | null; window_end: string | null };

/** BTC 15-minute round: live odds from /api/updown (polled), countdown to the round's end. */
function UpDownTile() {
  const [w, setW] = useState<Window | null>(null);
  const now = useNow(1000);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/updown")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!alive || !d?.windows) return;
          const btc = (d.windows as Window[]).filter((x) => x.asset === "BTC").sort((a, b) => String(a.window_end).localeCompare(String(b.window_end)));
          const cur = btc.find((x) => x.window_end && new Date(x.window_end).getTime() > Date.now()) ?? null;
          setW(cur);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  const left = w?.window_end && now !== null ? Math.max(0, Math.floor((new Date(w.window_end).getTime() - now) / 1000)) : null;
  const up = pc(w?.up_price ?? null);
  const down = pc(w?.down_price ?? null) ?? (up === null ? null : 100 - up);
  return (
    <Link
      href="/updown"
      className="pb-card-link"
      style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 20, padding: 18, display: "flex", flexDirection: "column", gap: 14, color: "var(--text)", position: "relative", overflow: "hidden" }}
    >
      <svg aria-hidden="true" viewBox="0 0 100 100" style={{ position: "absolute", insetInlineEnd: -30, bottom: -34, width: 190, height: 190, opacity: 0.08, pointerEvents: "none", color: "var(--text)" }}>
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="5" />
        <text x="50" y="68" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="54" fill="currentColor">
          ₿
        </text>
      </svg>
      <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
        <span style={{ fontSize: 17, fontWeight: 900 }}>صعودی یا نزولی</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--up)", background: "var(--upbg)", borderRadius: 6, padding: "1px 8px" }}>هر ۱۵ دقیقه</span>
        <span style={{ marginInlineStart: "auto", color: "var(--gold)" }}>←</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>بیت‌کوین · پایان این دور تا</span>
          <span dir="ltr" style={{ fontSize: 26, fontWeight: 900, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
            {left === null ? "—" : fa(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`)}
          </span>
        </div>
        <div style={{ marginInlineStart: "auto", display: "flex", gap: 6 }}>
          <span style={{ background: "var(--upbg)", color: "var(--up)", fontWeight: 800, fontSize: 14, borderRadius: 10, padding: "8px 12px" }}>▲ {up === null ? "—" : `${fa(up)}٪`}</span>
          <span style={{ background: "var(--downbg)", color: "var(--down)", fontWeight: 800, fontSize: 14, borderRadius: 10, padding: "8px 12px" }}>▼ {down === null ? "—" : `${fa(down)}٪`}</span>
        </div>
      </div>
      <span style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.8, position: "relative" }}>قیمت بیت‌کوین در پایان ۱۵ دقیقه بالاتر است یا پایین‌تر؟ سریع‌ترین بازار پلی‌باز.</span>
    </Link>
  );
}

const LEG_COLORS = ["var(--gold)", "var(--blue)", "var(--up)", "var(--home)", "var(--muted)"];

function BasketTile({ b }: { b: HomeBasket }) {
  return (
    <Link
      href={b.href}
      className="pb-card-link"
      style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 20, padding: 18, display: "flex", flexDirection: "column", gap: 14, color: "var(--text)", position: "relative", overflow: "hidden" }}
    >
      <svg aria-hidden="true" viewBox="0 0 100 90" style={{ position: "absolute", insetInlineEnd: -22, bottom: -26, width: 200, height: "auto", opacity: 0.08, pointerEvents: "none", color: "var(--text)" }}>
        <path d="M28 36 42 8M72 36 58 8" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <rect x="4" y="32" width="92" height="12" rx="4" fill="currentColor" />
        <path d="M12 48h76l-8 36H20Z" fill="currentColor" />
        <path d="M34 54v24M50 54v24M66 54v24" stroke="var(--bg)" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
        <span style={{ fontSize: 17, fontWeight: 900 }}>سبدها</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--gold)", background: "var(--goldbg)", borderRadius: 6, padding: "1px 8px" }}>چند پیش‌بینی در یک خرید</span>
        <span style={{ marginInlineStart: "auto", color: "var(--gold)" }}>←</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, position: "relative" }}>
        <span style={{ fontSize: 14.5, fontWeight: 700 }}>{b.title}</span>
        <div style={{ display: "flex", gap: 3, height: 8 }}>
          {b.legs.map((l, i) => (
            <span key={l.label + i} style={{ flex: Math.max(l.pct, 1), background: LEG_COLORS[i % LEG_COLORS.length], borderRadius: 4 }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: "var(--muted)" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.legs.map((l) => `${l.label} ${fa(l.pct)}٪`).join(" · ")}</span>
          {b.mult !== null && (
            <span style={{ flexShrink: 0 }}>
              ضریب <b style={{ color: "var(--text)" }}>×{fa(b.mult.toFixed(1))}</b>
            </span>
          )}
        </div>
      </div>
      <span style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.8, position: "relative" }}>سبدهای آماده یا ساختهٔ کاربران؛ پول را بین چند نتیجه پخش کنید.</span>
    </Link>
  );
}
