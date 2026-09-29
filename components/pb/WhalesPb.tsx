"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import type { MatchLive, SideKey, WhaleBet, WhaleGame } from "@/lib/api";
import { Crest } from "@/components/pb/Crest";
import { useNow } from "@/components/pb/useNow";
import { Avatar, ScoreRing } from "@/components/pb/ScoreRing";
import { betLabel, enSideNames, entryPct, sideNames, sideOutcome, tagOf, tierOf, whaleName } from "@/components/pb/whale";
import { fa, faAgo, faMoney, faPct, faTime, pc, SIDE_COLOR } from "@/lib/pb";

/**
 * PB Big Games Whales — today's five most-traded matches and the biggest
 * pre-match bets on each, with every bettor's 0–100 track-record score.
 * Data: GET /whales/today (oddzy-api, whales.js).
 */

type Filter = "all" | "sharp" | "contra" | "weak";

const FILTERS: [Filter, string][] = [
  ["all", "همه"],
  ["sharp", "فقط تیزبین‌ها"],
  ["contra", "روی کم‌شانس (زیر ۳۰٪)"],
  ["weak", "سابقهٔ ضعیف"],
];

function passes(f: Filter, b: WhaleBet): boolean {
  const s = b.stats;
  const isNew = s?.tier === "new";
  if (f === "sharp") return !!b.sharp || (!!s && !isNew && (s.score ?? 0) >= 80);
  if (f === "contra") return Math.round(b.avg_price * 100) <= 30;
  if (f === "weak") return !!s && !isNew && s.score !== null && s.score < 40;
  return true;
}

type Sel = { bet: WhaleBet; game: WhaleGame; names: Record<SideKey, string> };

export function WhalesPb({
  games: initialGames,
  finished: initialFinished = [],
  generatedAt,
  dateLabel,
}: {
  games: WhaleGame[];
  /** Today's games that have ended: listed after the top 5, collapsed, with their score. */
  finished?: WhaleGame[];
  generatedAt: string | null;
  dateLabel: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });
  const [how, setHow] = useState(false);
  const [sel, setSel] = useState<Sel | null>(null);
  const now = useNow(60_000);
  const ended = useEndedWatch(initialGames);

  // A game the live feed reports as ended leaves the ranking at once and joins
  // the finished list with its score — no page rebuild needed.
  const games = initialGames.filter((g) => !ended[g.slug]);
  const finished = [...initialGames.filter((g) => ended[g.slug]).map((g) => ({ ...g, live: ended[g.slug] })), ...initialFinished];

  const allBets = games.reduce((a, g) => a + g.whale_bet_count, 0);
  const allMoney = games.reduce((a, g) => a + (g.whale_total_usdc ?? 0), 0);

  return (
    <div dir="rtl" className="pb">
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "24px 16px 60px", display: "flex", flexDirection: "column", gap: 20 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--up)", fontWeight: 700 }}>
              <span className="pb-pulse" /> زنده
            </span>
            <span style={{ color: "var(--faint)" }}>·</span>
            <span>{dateLabel}</span>
            {generatedAt && now !== null && (
              <>
                <span style={{ color: "var(--faint)" }}>·</span>
                <span>به‌روز شده {faAgo(generatedAt, now)}</span>
              </>
            )}
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.35 }}>بازی‌های بزرگ امروز</h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.9, color: "var(--text2)", maxWidth: 620, textWrap: "pretty" }}>
            پرمعامله‌ترین بازی‌های امروز و بزرگ‌ترین پیش‌بینی‌هایی که نهنگ‌ها پیش از شروع بازی ثبت کرده‌اند، همراه با امتیاز سابقهٔ واقعی هر کدام.
          </p>
          {games.length > 0 && (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              {fa(games.length)} بازی · {fa(allBets)} پیش‌بینی بزرگ · {faMoney(allMoney)} پول نهنگ‌ها
            </div>
          )}
        </header>

        <ScoreLegend how={how} setHow={setHow} />

        <div className="pb-noscroll" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -16px", padding: "0 16px" }}>
          {FILTERS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              style={{
                flexShrink: 0,
                padding: "8px 14px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                border: `1px solid ${k === filter ? "var(--goldline)" : "var(--line)"}`,
                background: k === filter ? "var(--goldbg)" : "var(--card)",
                color: k === filter ? "var(--gold)" : "var(--text2)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {games.map((g, gi) => (
          <GameCard
            key={g.slug}
            g={g}
            rank={gi + 1}
            open={!!open[gi]}
            toggle={() => setOpen((o) => ({ ...o, [gi]: !o[gi] }))}
            filter={filter}
            now={now}
            onSelect={setSel}
          />
        ))}

        {finished.length > 0 && (
          <section style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>بازی‌های تمام‌شدهٔ امروز</h2>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>نتیجه و پیش‌بینی نهنگ‌ها پیش از بازی</span>
            </div>
            {finished.map((g, gi) => (
              <GameCard
                key={g.slug}
                g={g}
                rank={gi + 1}
                done
                open={!!open[100 + gi]}
                toggle={() => setOpen((o) => ({ ...o, [100 + gi]: !o[100 + gi] }))}
                filter={filter}
                now={now}
                onSelect={setSel}
              />
            ))}
          </section>
        )}

        {games.length < 5 && (
          <div style={{ border: "1px dashed var(--line2)", borderRadius: 16, padding: "18px 16px", display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {games.length === 0 ? "امروز هنوز بازی‌ای به فهرست بازی‌های بزرگ نرسیده است." : `امروز فقط ${fa(games.length)} بازی به فهرست بازی‌های بزرگ رسیده است.`}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>فهرست در طول روز و با بالا رفتن حجم معاملات به‌روز می‌شود.</div>
            <Link href="/topic/football" style={{ fontSize: 13, fontWeight: 700 }}>
              همهٔ بازی‌های فوتبال ←
            </Link>
          </div>
        )}

        <div style={{ fontSize: 11.5, color: "var(--faint)", lineHeight: 1.9 }}>
          نهنگ یعنی حسابی در Polymarket با پیش‌بینی‌های بزرگ.
        </div>
      </main>
      {sel && <WhaleSheet sel={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function ScoreLegend({ how, setHow }: { how: boolean; setHow: (v: boolean) => void }) {
  const dot = (c: string, ring?: boolean): CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    ...(ring ? { border: `1.5px solid ${c}` } : { background: c }),
  });
  const items: [string, string, string, boolean?][] = [
    ["var(--down)", "پایین‌تر از میانگین", "۰–۳۹"],
    ["var(--muted)", "میانگین", "۴۰–۵۹"],
    ["var(--above)", "بالاتر از میانگین", "۶۰–۷۹"],
    ["var(--up)", "تیزبین", "۸۰–۱۰۰"],
    ["var(--blue)", "تازه‌وارد", "امتیاز موقت", true],
  ];
  return (
    <section style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 800 }}>امتیاز نهنگ</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>۰ تا ۱۰۰، بر پایهٔ سابقهٔ واقعی معاملات</span>
        <button
          type="button"
          onClick={() => setHow(!how)}
          style={{ marginInlineStart: "auto", background: "none", border: "none", color: "var(--gold)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}
        >
          {how ? "بستن" : "چطور حساب می‌شود؟"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 3, height: 6 }} aria-hidden>
        <span style={{ flex: 40, background: "var(--down)", borderRadius: 3 }} />
        <span style={{ flex: 20, background: "var(--muted)", borderRadius: 3 }} />
        <span style={{ flex: 20, background: "var(--above)", borderRadius: 3 }} />
        <span style={{ flex: 21, background: "var(--up)", borderRadius: 3 }} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 12, color: "var(--text2)" }}>
        {items.map(([c, l, r, ring]) => (
          <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={dot(c, ring)} />
            {l} <span style={{ color: "var(--faint)" }}>{r}</span>
          </span>
        ))}
      </div>
      {how && (
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.9, color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: 11, textWrap: "pretty" }}>
          امتیاز از نتیجهٔ واقعی معاملات هر حساب ساخته می‌شود: بازده نسبت به حجم در کل سابقه (۶۰٪ وزن) و در ۳۰ روز اخیر (۴۰٪ وزن)، با احتساب ضررها. حجم زیاد به‌تنهایی امتیاز بالا نمی‌آورد. حساب‌هایی با کمتر از ۱۰ هزار دلار حجم کل «تازه‌وارد» حساب می‌شوند و امتیازشان هنوز قطعی نیست. روی هر نهنگ بزنید تا جزئیات سابقه‌اش را ببینید.
        </p>
      )}
    </section>
  );
}

function GameCard({
  g,
  rank,
  done,
  open,
  toggle,
  filter,
  now,
  onSelect,
}: {
  g: WhaleGame;
  rank: number;
  /** Finished: score instead of odds, no rank, no predict CTA. */
  done?: boolean;
  open: boolean;
  toggle: () => void;
  filter: Filter;
  now: number | null;
  onSelect: (s: Sel) => void;
}) {
  const names = sideNames(g);
  const href = `/match/${g.slug}`;
  const sides = g.result?.sides ?? [];
  const bets = g.whales;
  const rows = bets.filter((b) => passes(filter, b));
  const hasMoney = (g.result?.result_whale_usdc ?? 0) > 0;
  const agree = g.result?.verdict === "with_market";
  const verdict = g.result?.verdict ? (agree ? "نهنگ‌ها هم‌جهت با بازار" : "نهنگ‌ها خلاف بازار") : null;
  const league = g.league.name_fa ?? g.league.name;

  // One-line insight: where the whale money sits vs the market, plus a sharp contrarian if any.
  let insight = "";
  if (hasMoney) {
    const lead = [...sides].sort((a, b) => b.whale_usdc - a.whale_usdc)[0];
    insight = `${fa(pc(lead.whale_share) ?? 0)}٪ پول نهنگ‌ها روی «${sideOutcome(lead.key, names)}» است؛ بازار به آن ${faPct(lead.p)} شانس می‌دهد.`;
    const sharp = bets.find((b) => b.stats && b.stats.tier !== "new" && (b.stats.score ?? 0) >= 80 && b.avg_price <= 0.3);
    if (sharp) insight += ` ${whaleName(sharp)} با امتیاز ${fa(sharp.stats!.score!)}، خلاف جریان روی «${betLabel(sharp, names, enSideNames(g))}» رفته است.`;
  }

  return (
    <article style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 20, overflow: "hidden" }}>
      <div style={{ padding: "16px 16px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: done ? 18 : 26, fontWeight: 900, color: done ? "var(--muted)" : "var(--gold)", lineHeight: 1.1, width: 22, flexShrink: 0 }}>
            {done ? "✓" : fa(rank)}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {league}
              {g.starts_at ? ` · ${faTime(g.starts_at)} به وقت تهران` : ""}
            </div>
            <Link href={href} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 19, fontWeight: 800, color: "var(--text)", lineHeight: 1.45 }}>
              <Crest name={names.home} src={g.teams?.home?.logo} size={26} />
              <span>{names.home}</span>
              <span style={{ color: "var(--faint)", fontWeight: 400, fontSize: 15 }}>و</span>
              <Crest name={names.away} src={g.teams?.away?.logo} size={26} />
              <span>{names.away}</span>
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end", flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>حجم ۲۴ ساعت</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{faMoney(g.volume_24h)}</span>
          </div>
        </div>
        {done && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              background: "var(--bg2)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "12px 10px",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>پایان بازی</span>
            {g.live?.score && (
              <span dir="ltr" style={{ fontSize: 26, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
                {fa(g.live.score.away)} – {fa(g.live.score.home)}
              </span>
            )}
          </div>
        )}
        {!done && sides.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${sides.length},minmax(0,1fr))`, gap: 6 }}>
            {sides.map((s) => {
              const col = SIDE_COLOR[s.key];
              return (
                <Link
                  key={s.key}
                  href={href}
                  className="pb-tile"
                  style={
                    {
                      "--tint": col.bg,
                      "--col": col.c,
                      background: "var(--bg2)",
                      border: "1px solid var(--line)",
                      borderRadius: 14,
                      padding: "14px 10px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      gap: 4,
                      color: "var(--text)",
                      minWidth: 0,
                    } as CSSProperties
                  }
                >
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12.5, color: "var(--muted)", minWidth: 0, maxWidth: "100%" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: col.c, flexShrink: 0 }} />
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sideOutcome(s.key, names)}</span>
                  </span>
                  <span style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.15 }}>{faPct(s.p)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="pb-row"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          border: "none",
          borderTop: "1px solid var(--line)",
          background: "var(--bg2)",
          color: "var(--text)",
          cursor: "pointer",
          textAlign: "right",
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 800 }}>نهنگ‌ها</span>
        <span style={{ fontSize: 12, color: "var(--muted)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {g.whale_bet_count ? `${fa(g.whale_bet_count)} پیش‌بینی · ${faMoney(g.whale_total_usdc)}` : "هنوز نهنگی وارد نشده"}
        </span>
        {verdict && (
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 800,
              padding: "2px 9px",
              borderRadius: 999,
              color: agree ? "var(--text2)" : "var(--gold)",
              background: agree ? "var(--card)" : "var(--goldbg)",
              flexShrink: 0,
            }}
          >
            {verdict}
          </span>
        )}
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "1px solid var(--line)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            color: "var(--muted)",
            flexShrink: 0,
            transform: `rotate(${open ? 180 : 0}deg)`,
            transition: "transform .2s",
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <>
          <div style={{ background: "var(--bg2)", borderTop: "1px solid var(--line)" }}>
            <div style={{ padding: "13px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}>نهنگ‌ها پیش از بازی</span>
                {g.whale_bet_count > 0 && (
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {fa(g.whale_bet_count)} پیش‌بینی · {faMoney(g.whale_total_usdc)}
                  </span>
                )}
              </div>
              {hasMoney && (
                <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>بازار در برابر نهنگ‌ها</span>
                    {verdict && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          padding: "3px 10px",
                          borderRadius: 999,
                          color: agree ? "var(--text2)" : "var(--gold)",
                          background: agree ? "var(--bg2)" : "var(--goldbg)",
                        }}
                      >
                        {verdict}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: "var(--muted)", flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 18, height: 5, borderRadius: 3, background: "var(--line2)" }} />
                      شانسی که بازار می‌دهد
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--home)" }} />
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--blue)", marginInlineStart: -3 }} />
                      سهم از پول نهنگ‌ها
                    </span>
                  </div>
                  {sides.map((s) => {
                    const col = SIDE_COLOR[s.key];
                    const mk = pc(s.p) ?? 0;
                    const wh = pc(s.whale_share) ?? 0;
                    const df = wh - mk;
                    return (
                      <div key={s.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 9, height: 9, borderRadius: "50%", background: col.c, flexShrink: 0 }} />
                          <span style={{ fontSize: 14, fontWeight: 800, flex: 1, minWidth: 0 }}>{sideOutcome(s.key, names)}</span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: Math.abs(df) < 5 ? "var(--muted)" : df > 0 ? "var(--up)" : "var(--down)" }}>
                            {Math.abs(df) < 5 ? "هم‌اندازهٔ بازار" : df > 0 ? `▲ ${fa(df)} واحد بیشتر از بازار` : `▼ ${fa(-df)} واحد کمتر از بازار`}
                          </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "54px 1fr 64px", gap: "4px 10px", alignItems: "center" }}>
                          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>بازار</span>
                          <div style={{ height: 6, background: "var(--bg2)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${mk}%`, background: "var(--line2)", borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text2)", textAlign: "left" }}>{fa(mk)}٪</span>
                          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>نهنگ‌ها</span>
                          <div style={{ height: 12, background: "var(--bg2)", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${wh}%`, background: col.c, borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 15, fontWeight: 900, textAlign: "left" }}>{fa(wh)}٪</span>
                        </div>
                        <span style={{ fontSize: 11.5, color: "var(--faint)", paddingInlineStart: 64 }}>
                          {s.whale_usdc > 0 ? `${faMoney(s.whale_usdc)} پول نهنگ‌ها` : "بدون پول نهنگ"}
                        </span>
                      </div>
                    );
                  })}
                  {insight && (
                    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, fontSize: 14, lineHeight: 1.9, color: "var(--text)", textWrap: "pretty" }}>{insight}</div>
                  )}
                </div>
              )}
            </div>

            {rows.map((b) => {
              const t = tierOf(b.stats);
              const tag = tagOf(b);
              const side = b.side_key ?? null;
              return (
                <div
                  key={`${b.wallet}-${b.market.id}-${b.outcome_index}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect({ bet: b, game: g, names })}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect({ bet: b, game: g, names })}
                  className="pb-row"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", borderTop: "1px solid var(--line)" }}
                >
                  <ScoreRing score={b.stats?.score ?? null} color={t.c} />
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      <Avatar name={whaleName(b)} src={b.profile_image} />
                      <span dir="ltr" style={{ fontSize: 14, fontWeight: 700 }}>
                        {whaleName(b)}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: t.c }}>{t.label}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: side ? SIDE_COLOR[side].c : "var(--faint)" }} />
                      <span style={{ color: "var(--text)", fontWeight: 600 }}>{betLabel(b, names, enSideNames(g))}</span>
                      <span>در قیمت {entryPct(b)}</span>
                      {now !== null && (
                        <>
                          <span style={{ color: "var(--faint)" }}>·</span>
                          <span>{faAgo(b.last_at, now)}</span>
                        </>
                      )}
                    </div>
                    {tag && (
                      <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, color: tag.c, background: tag.bg }}>{tag.label}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end", flexShrink: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{faMoney(b.amount_usdc)}</span>
                    <span style={{ fontSize: 11, color: "var(--faint)" }}>جزئیات ‹</span>
                  </div>
                </div>
              );
            })}

            {g.whale_bet_count === 0 && !g.error && (
              <div style={{ padding: "20px 16px 22px", display: "flex", flexDirection: "column", gap: 6, alignItems: "center", textAlign: "center" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    border: "1.5px dashed var(--line2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--faint)",
                    fontSize: 18,
                  }}
                >
                  ·
                </div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>هنوز نهنگی وارد این بازی نشده</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.8 }}>پیش‌بینی‌های بزرگ به‌محض ثبت، اینجا نشان داده می‌شوند.</div>
              </div>
            )}
            {g.error && (
              <div style={{ padding: "12px 16px 14px", fontSize: 12.5, color: "var(--muted)", borderTop: "1px solid var(--line)" }}>
                داده‌های نهنگ‌ها برای این بازی موقتاً در دسترس نیست.
              </div>
            )}
            {bets.length > 0 && rows.length === 0 && (
              <div style={{ padding: "12px 16px 14px", fontSize: 12.5, color: "var(--muted)", borderTop: "1px solid var(--line)" }}>
                در این فیلتر، پیش‌بینی‌ای برای این بازی نیست.
              </div>
            )}
          </div>
          <div style={{ padding: "12px 16px 16px", borderTop: "1px solid var(--line)", display: "flex" }}>
            <Link href={href} className="pb-gold-btn" style={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: 15, padding: 13, borderRadius: 13 }}>
              {done ? "مشاهدهٔ بازی" : "پیش‌بینی این بازی"}
            </Link>
          </div>
        </>
      )}
    </article>
  );
}

function WhaleSheet({ sel, onClose }: { sel: Sel; onClose: () => void }) {
  const { bet: b, game: g, names } = sel;
  const s = b.stats;
  const t = tierOf(s);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const signed = (v: number | null | undefined, fmt: (n: number) => string) =>
    v === null || v === undefined
      ? { v: "—", c: "var(--muted)" }
      : { v: `${v >= 0 ? "▲ " : "▼ "}${fmt(Math.abs(v))}`, c: v >= 0 ? "var(--up)" : "var(--down)" };
  const pnl = signed(s?.pnl_usdc, faMoney);
  const rov = signed(s?.all_time_roi, (n) => `${fa((n * 100).toFixed(1))}٪`);
  const m30 = signed(s?.month_pnl_usdc, faMoney);
  const stats = [
    { l: "سود و زیان کل", ...pnl },
    { l: "بازده نسبت به حجم", ...rov },
    { l: "۳۰ روز اخیر", ...m30 },
    { l: "حجم کل معاملات", v: faMoney(s?.volume_usdc), c: "var(--text)" },
    { l: "بازارهای معامله‌شده", v: s?.markets_traded ? fa(s.markets_traded.toLocaleString("en-US")) : "—", c: "var(--text)" },
    { l: "رتبه در جدول", v: s?.rank ? fa(s.rank.toLocaleString("en-US")) : "هنوز رتبه ندارد", c: s?.rank ? "var(--text)" : "var(--muted)" },
  ];
  const name = whaleName(b);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "var(--scrim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={name}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "calc(100dvh - 32px)",
          overflowY: "auto",
          margin: "auto",
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 22,
          padding: "18px 18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          animation: "pbup .22s ease-out",
          boxShadow: "0 -20px 60px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <ScoreRing score={s?.score ?? null} color={t.c} size={68} stroke={3} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar name={name} src={b.profile_image} size={30} />
              <span dir="ltr" style={{ fontSize: 17, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis" }}>
                {name}
              </span>
            </div>
            <span style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 700, color: t.c, border: `1px solid ${t.c}`, borderRadius: 999, padding: "1px 10px" }}>{t.label}</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {s?.tier === "new" ? "سابقهٔ کوتاه؛ امتیاز موقت است" : s?.score !== null && s ? `امتیاز ${fa(s.score!)} از ۱۰۰ بر پایهٔ سابقهٔ واقعی` : "سابقه‌ای در جدول Polymarket ندارد"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            style={{
              alignSelf: "flex-start",
              width: 32,
              height: 32,
              flexShrink: 0,
              borderRadius: "50%",
              border: "1px solid var(--line)",
              background: "var(--bg2)",
              color: "var(--muted)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
          {stats.map((x) => (
            <div key={x.l} style={{ background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{x.l}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: x.c }}>{x.v}</span>
            </div>
          ))}
        </div>
        {b.sharp && (
          <div style={{ border: "1px solid var(--up)", background: "var(--upbg)", borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "var(--up)", fontWeight: 800 }}>تیزبین فوتبال</span>
            <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.8 }}>
              بازده {fa(Math.round(b.sharp.roi * 100))}٪ در {fa(b.sharp.events)} بازی فوتبال
              {b.sharp.wins !== null && b.sharp.losses !== null ? ` · ${fa(b.sharp.wins)} برد، ${fa(b.sharp.losses)} باخت` : ""}
              {b.sharp.pnl_usdc !== null ? ` · سود ${faMoney(b.sharp.pnl_usdc)}` : ""}
            </span>
          </div>
        )}
        <div style={{ border: "1px solid var(--goldline)", background: "var(--goldbg)", borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            در این بازی · {names.home} و {names.away}
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.7 }}>
            {faMoney(b.amount_usdc)} روی «{betLabel(b, names, enSideNames(g))}» در قیمت {entryPct(b)}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <a
            href={b.profile_url}
            target="_blank"
            rel="noopener nofollow"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 11,
              borderRadius: 13,
              border: "1px solid var(--line2)",
              background: "var(--bg2)",
              color: "var(--text)",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            <span>مشاهدهٔ پروفایل در Polymarket</span>
            <span dir="ltr" style={{ color: "var(--muted)", fontSize: 12 }}>
              {b.name ? `@${b.name}` : `${b.wallet.slice(0, 6)}…`} ↗
            </span>
          </a>
          <Link href={`/match/${g.slug}`} className="pb-gold-btn" style={{ textAlign: "center", fontWeight: 800, fontSize: 15, padding: 13, borderRadius: 13 }}>
            رفتن به صفحهٔ بازی
          </Link>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 12,
              borderRadius: 13,
              border: "1px dashed var(--line2)",
              color: "var(--faint)",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            کپی این معامله‌گر{" "}
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", background: "var(--bluebg)", borderRadius: 6, padding: "1px 7px" }}>به‌زودی</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Watch the ranked games that should be finishing, and report the ones that
 * have: from kickoff + 110 minutes (a football match runs ~1h55 with
 * half-time and stoppage time), each such game's live state is polled every
 * 30s through /api/match — the CDN-cached feed the match page uses — until it
 * says "ended". Nothing is polled before that point, so a page of games that
 * are hours away costs no requests at all.
 */
const EXPECTED_END_MS = 110 * 60_000;

function useEndedWatch(games: WhaleGame[]): Record<string, MatchLive> {
  const [ended, setEnded] = useState<Record<string, MatchLive>>({});
  const now = useNow(30_000);
  useEffect(() => {
    if (now === null) return;
    const due = games.filter(
      (g) => !ended[g.slug] && g.starts_at && now - new Date(g.starts_at).getTime() >= EXPECTED_END_MS,
    );
    if (!due.length) return;
    let alive = true;
    Promise.all(
      due.map((g) =>
        fetch(`/api/match/${encodeURIComponent(g.slug)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => (d?.live?.status === "ended" ? ([g.slug, d.live as MatchLive] as const) : null))
          .catch(() => null),
      ),
    ).then((res) => {
      const hits = res.filter((x): x is readonly [string, MatchLive] => x !== null);
      if (alive && hits.length) setEnded((cur) => ({ ...cur, ...Object.fromEntries(hits) }));
    });
    return () => {
      alive = false;
    };
    // Re-evaluated on every 30s tick; `ended` is read, not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, games]);
  return ended;
}
