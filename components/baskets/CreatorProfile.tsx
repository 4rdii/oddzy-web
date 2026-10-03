"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/app/LocaleProvider";
import { authedPost, ApiCallError } from "@/lib/client-api";
import { localized } from "@/lib/format";
import {
  BasketCard,
  avatarColor,
  optionalAuthHeaders,
  type CommunityBasket,
} from "./BasketCard";

/**
 * A creator's public profile — header, three stat cards, the cumulative
 * return chart, then Active baskets and the Track record, per the
 * design_handoff_baskets Creator Profile screens.
 *
 * The page a creator sends to people who don't have accounts, so it fetches
 * from the public endpoint and renders fully for a logged-out visitor. Only the
 * Follow button needs a credential, and it says so when pressed.
 *
 * Every number is grounded: win rate from settled legs; return and the chart
 * from CREATION prices — each fully-settled basket scored as $1 spread across
 * its legs at the prices recorded when it was published
 * (basket_legs.price_at_publish), so the record exists whether or not anyone
 * bought and cannot be flattered by when buyers arrived; fees from the sharer
 * accrual. Where a number cannot be computed the card shows a dash — the
 * design's +15.2% is a mock, and an invented figure is worse than an empty one.
 */

type Creator = {
  id: string | null;
  name: string | null;
  /** The same byline in Persian. Null → fall back to name. */
  nameFa?: string | null;
  verified: boolean;
  followers: number;
  accuracy: number | null;
  viewerFollows: boolean;
  basketCount: number;
  totalBuys: number;
  /** User creators only — account creation date. */
  memberSince?: string | null;
  /** House profile only — raw settled-leg record behind (or below) `accuracy`. */
  settledLegs?: number;
  wonLegs?: number;
};

type Perf = {
  settledStakeUsdc: number;
  pnlUsdc: number;
  buyers: number;
  feesUsdc: number | null;
  monthly: Array<{ month: string; stakeUsdc: number; pnlUsdc: number }>;
  perBasket: Array<{ slug: string; stakeUsdc: number; pnlUsdc: number }>;
};

const signedPct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

export function CreatorProfile({ creatorId }: { creatorId: string }) {
  const { locale, t, rtl, brand } = useLocale();
  const c = t.communityBaskets;
  const p = t.creatorProfile;

  const [creator, setCreator] = useState<Creator | null>(null);
  const [perf, setPerf] = useState<Perf | null>(null);
  const [baskets, setBaskets] = useState<CommunityBasket[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [activeOpen, setActiveOpen] = useState(true);
  const [recordOpen, setRecordOpen] = useState(true);
  /** Which record row is expanded to show its predictions. */
  const [openRecord, setOpenRecord] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await fetch(`/api/webapp/v1/creator?id=${encodeURIComponent(creatorId)}`, {
          signal,
          cache: "no-store",
          headers: await optionalAuthHeaders(),
        });
        if (res.status === 404) {
          setState("missing");
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          creator: Creator;
          perf?: Perf;
          baskets: CommunityBasket[];
        };
        setCreator(data.creator);
        setPerf(data.perf ?? null);
        setBaskets(data.baskets ?? []);
        setState("ready");
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") setState("missing");
      }
    },
    [creatorId],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  async function toggleFollow() {
    if (!creator?.id) return;
    const wanted = !creator.viewerFollows;
    const before = creator;

    setCreator({
      ...creator,
      viewerFollows: wanted,
      followers: Math.max(0, creator.followers + (wanted ? 1 : -1)),
    });
    setNotice(null);

    try {
      const res = await authedPost<{ followers: number; following: boolean }>(
        "/webapp/v1/follow",
        { creatorTgUserId: creator.id, follow: wanted },
      );
      setCreator((cur) =>
        cur ? { ...cur, viewerFollows: res.following, followers: res.followers } : cur,
      );
    } catch (e) {
      setCreator(before);
      const err = e as ApiCallError;
      setNotice(
        err.kind === "unauthenticated" || err.kind === "no_account"
          ? c.signInToFollow
          : c.followFailed,
      );
    }
  }

  if (state === "loading") {
    return <p className="py-16 text-center text-[14px] text-[var(--faint)]">{c.loading}</p>;
  }

  if (state === "missing" || !creator) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-10 text-center">
        <p className="text-[14px] text-[var(--mute)]">{p.notFound}</p>
      </div>
    );
  }

  /**
   * `house*` ids are the editorial desks: `house-daily` (all-sports baskets),
   * `house-world` (everything else), `house` (the lot). Their baskets have no
   * creator row, so the API reserves these ids — non-numeric, since positive
   * ids are Telegram users and NEGATIVE ids are web-auth users — and this
   * page renders the desk as the byline: gold ★ avatar, no Follow button
   * (there is nobody to follow) and no follower count — but the same accuracy
   * discipline as everyone else, because "trust our picks" is exactly the
   * claim a track record exists to check.
   */
  const isHouse = creatorId === "house" || creatorId.startsWith("house-");
  const housePersona =
    creatorId === "house-daily" ? ("daily" as const)
    : creatorId === "house-world" ? ("world" as const)
    : null;
  // Localised like a basket title: one profile is served to both brands.
  const chosenName = localized(locale, creator.name ?? "", creator.nameFa) || null;
  const name = isHouse
    ? housePersona ? c.personas[housePersona] : brand.name
    : (chosenName ?? c.anonymous);
  const initial = (chosenName ?? "?").replace(/^@/, "").charAt(0).toUpperCase();

  const active = baskets.filter((b) => b.status !== "archived");
  const past = baskets.filter((b) => b.status === "archived");

  // Win rate from the baskets' own settled legs — the same numbers the
  // track-record rows below print, so the card can never disagree with them.
  const settledLegs = baskets.reduce((n, b) => n + (b.settledLegs ?? 0), 0);
  const wonLegs = baskets.reduce((n, b) => n + (b.wonLegs ?? 0), 0);
  const winRate = settledLegs > 0 ? wonLegs / settledLegs : null;

  const returnPct =
    perf && perf.settledStakeUsdc > 0 ? (perf.pnlUsdc / perf.settledStakeUsdc) * 100 : null;

  const memberSince = !isHouse && creator.memberSince ? new Date(creator.memberSince) : null;
  const memberSinceLabel = memberSince
    ? new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
        year: "numeric",
        month: "long",
      }).format(memberSince)
    : null;

  const perBasket = new Map((perf?.perBasket ?? []).map((r) => [r.slug, r]));

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[24px] font-extrabold text-white"
          style={{ background: isHouse ? "var(--bk-goldmuted)" : avatarColor(creator.id) }}
        >
          {isHouse ? "★" : initial}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-[22px] font-extrabold text-[var(--ink)]">
            {name}
            {(isHouse || creator.verified) && (
              <span
                aria-label={isHouse ? c.editorial : c.verified}
                className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-extrabold"
                style={{ background: "var(--bk-gold)", color: "#1a1405" }}
              >
                ✓
              </span>
            )}
          </h1>
          <p className="mt-0.5 text-[13px] text-[var(--mute)]">
            {isHouse
              ? c.editorial
              : c.followersLabel.replace("{n}", String(creator.followers))}
            {memberSinceLabel && ` · ${p.memberSince.replace("{date}", memberSinceLabel)}`}
          </p>
        </div>
        {!isHouse && (
          <button
            type="button"
            onClick={toggleFollow}
            className="rounded-full border px-4 py-2 text-[13px] font-semibold"
            style={{
              background: creator.viewerFollows ? "var(--bk-goldtint)" : "transparent",
              borderColor: creator.viewerFollows ? "#b08d2f" : "var(--line)",
              color: creator.viewerFollows ? "var(--bk-gold)" : "var(--mute)",
            }}
          >
            {creator.viewerFollows ? c.following : c.follow}
          </button>
        )}
      </div>

      {notice && (
        <p className="rounded-lg bg-[var(--bk-goldtint)] p-2.5 text-[13px] text-[var(--bk-warn)]">
          {notice}
        </p>
      )}

      {/* The three performance cards */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
        <StatCard
          label={p.winRate}
          value={winRate != null ? `${Math.round(winRate * 100)}%` : "—"}
          color={winRate == null ? "var(--mute)" : winRate >= 0.5 ? "var(--bk-green)" : "var(--down)"}
          sub={p.acrossSettled.replace("{n}", String(settledLegs))}
        />
        <StatCard
          label={p.basketReturn}
          value={returnPct != null ? signedPct(returnPct) : "—"}
          color={returnPct == null ? "var(--mute)" : returnPct >= 0 ? "var(--bk-green)" : "var(--down)"}
          sub={p.publishedCount.replace("{n}", String(baskets.length))}
        />
        {!isHouse && perf?.feesUsdc != null ? (
          <StatCard
            label={p.feesEarned}
            value={`$${perf.feesUsdc.toFixed(perf.feesUsdc >= 100 ? 0 : 2)}`}
            color="var(--bk-gold)"
            sub={p.fromBuyers.replace("{n}", String(perf.buyers))}
          />
        ) : (
          <StatCard
            label={p.buyersCard}
            value={String(perf?.buyers ?? creator.totalBuys)}
            color="var(--bk-gold)"
            sub={p.acrossBaskets}
          />
        )}
      </div>

      {/* Cumulative return chart — only once there are two real months to
          draw a line between. A one-point or empty chart is decoration. */}
      {perf && perf.perBasket.length >= 2 && (
        <ReturnChart perBasket={perf.perBasket} baskets={baskets} title={p.cumulativeReturn} meta={p.chartMeta} locale={locale} />
      )}

      {/* Active baskets */}
      {active.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setActiveOpen((v) => !v)}
            className="flex items-center justify-between text-[var(--ink)]"
          >
            <span className="text-[14px] font-extrabold">{p.activeBaskets}</span>
            <span className="text-[12px] text-[var(--mute)]" aria-hidden>
              {activeOpen ? "▲" : "▼"}
            </span>
          </button>
          {activeOpen && (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
              {active.map((b) => (
                <BasketCard key={b.slug} basket={b} showCreator={false} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Track record — the archived baskets, one row each. Every row shows
          the date and its X-of-Y hit count; the right-hand figure is the
          buyers' realized return where anyone actually bought, a dash where
          nobody did. A row expands in place to list its predictions with
          their outcomes — the archived detail page 404s on purpose, so this
          is where the receipts live. */}
      {past.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setRecordOpen((v) => !v)}
            className="flex items-center justify-between text-[var(--ink)]"
          >
            <span className="text-[14px] font-extrabold">{p.trackRecord}</span>
            <span className="text-[12px] text-[var(--mute)]" aria-hidden>
              {recordOpen ? "▲" : "▼"}
            </span>
          </button>
          {recordOpen && (
            <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]">
              {past.map((b, i) => {
                const settled = b.settledLegs ?? 0;
                const won = b.wonLegs ?? 0;
                const hit = p.hitOf
                  .replace("{won}", String(won))
                  .replace("{n}", String(settled));
                const real = perBasket.get(b.slug);
                const pl =
                  real && real.stakeUsdc > 0 ? (real.pnlUsdc / real.stakeUsdc) * 100 : null;
                const when = b.publishedAt
                  ? new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    }).format(new Date(b.publishedAt))
                  : null;
                const expanded = openRecord === b.slug;
                return (
                  <div key={b.slug} style={{ borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
                    <button
                      type="button"
                      onClick={() => setOpenRecord(expanded ? null : b.slug)}
                      aria-expanded={expanded}
                      className="flex w-full items-center justify-between gap-3.5 px-[18px] py-3.5 text-start"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-semibold text-[var(--ink)]">
                          {localized(locale, b.titleEn, b.titleFa)}
                        </div>
                        <div className="mt-0.5 text-[12px] text-[var(--mute)]">
                          {when}
                          {settled > 0 && `${when ? " · " : ""}${hit}`}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        <span
                          className="whitespace-nowrap text-[13px] font-extrabold tabular-nums"
                          style={{
                            color:
                              pl == null
                                ? "var(--faint)"
                                : pl >= 0
                                  ? "var(--bk-green)"
                                  : "var(--down)",
                          }}
                        >
                          {pl != null ? signedPct(pl) : "—"}
                        </span>
                        <span className="text-[10px] text-[var(--faint)]" aria-hidden>
                          {expanded ? "▲" : "▼"}
                        </span>
                      </div>
                    </button>
                    {expanded && (b.legs?.length ?? 0) > 0 && (
                      <ul className="flex flex-col gap-2 px-[18px] pb-4">
                        {b.legs!.map((leg, j) => {
                          const state =
                            leg.outcome == null ? "open"
                            : leg.outcome === "VOID" ? "void"
                            : leg.outcome === leg.side ? "won"
                            : "lost";
                          return (
                            <li key={j} className="flex items-center gap-2.5 text-[13px]">
                              <span
                                aria-hidden
                                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
                                style={{
                                  background:
                                    state === "won" ? "var(--bk-greenbg)"
                                    : state === "lost" ? "rgba(224,112,90,0.14)"
                                    : "var(--chip, var(--line))",
                                  color:
                                    state === "won" ? "var(--bk-green)"
                                    : state === "lost" ? "var(--down)"
                                    : "var(--faint)",
                                }}
                              >
                                {state === "won" ? "✓" : state === "lost" ? "✗" : "–"}
                              </span>
                              <span
                                className="min-w-0 flex-1 truncate"
                                style={{
                                  color: state === "open" ? "var(--faint)" : "var(--text2, var(--ink))",
                                }}
                              >
                                {localized(locale, leg.title, leg.titleFa)}
                              </span>
                              <span
                                dir="ltr"
                                className="shrink-0 text-[11px] font-bold text-[var(--faint)]"
                              >
                                {leg.side}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[14px] border border-[var(--line)] bg-[var(--card)] px-[18px] py-4">
      <div className="text-[12px] text-[var(--mute)]">{label}</div>
      <div dir="ltr" className="text-[24px] font-extrabold tabular-nums" style={{ color, textAlign: "start" }}>
        {value}
      </div>
      <div className="text-[11px] text-[var(--faint)]">{sub}</div>
    </div>
  );
}

/** $ put into every scored basket for the chart's running P&L. */
const CHART_STAKE_PER_BASKET = 100;

/**
 * Profit to date for someone who put $100 into every one of the creator's
 * baskets, night by night — winnings are NOT reinvested, each basket is a fresh
 * $100. One point per day from the first settled basket to today (flat on
 * nights with none), starting at $0, so the line reads "how much would I be up
 * by this day". Each basket's result is the backend's per-$1 score
 * (pnlUsdc / stakeUsdc) at publish-time prices, the same basis as the cards.
 *
 * Replaces a monthly running sum (two points over two months, starting at the
 * first month's total) that drew a near-flat line.
 */
function ReturnChart({
  perBasket,
  baskets,
  title,
  meta,
  locale,
}: {
  perBasket: Perf["perBasket"];
  baskets: CommunityBasket[];
  title: string;
  meta: string;
  locale: string;
}) {
  const TZ = "Asia/Tehran";
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
  const published = new Map(baskets.map((b) => [b.slug, b.publishedAt ?? null]));
  // The night a basket belongs to: its publish date, else the date in its slug.
  const nightOf = (slug: string): string | null => {
    const at = published.get(slug);
    if (at) return dayKey(new Date(at));
    return /(\d{4}-\d{2}-\d{2})$/.exec(slug)?.[1] ?? null;
  };
  const byNight = new Map<string, number[]>();
  for (const pb of perBasket) {
    const night = nightOf(pb.slug);
    if (!night || !(pb.stakeUsdc > 0)) continue;
    const list = byNight.get(night) ?? [];
    list.push(pb.pnlUsdc / pb.stakeUsdc);
    byNight.set(night, list);
  }
  const nights = [...byNight.keys()].sort();
  if (nights.length === 0) return null;

  const points: Array<{ day: string; v: number }> = [];
  let pnl = 0;
  const today = dayKey(new Date());
  for (let d = new Date(`${nights[0]}T12:00:00Z`); dayKey(d) <= today; d = new Date(d.getTime() + 86_400_000)) {
    for (const r of byNight.get(dayKey(d)) ?? []) pnl += r * CHART_STAKE_PER_BASKET;
    points.push({ day: dayKey(d), v: pnl });
    if (points.length > 400) break;
  }

  const last = points[points.length - 1]!.v;
  const lo = Math.min(0, ...points.map((pt) => pt.v));
  const hi = Math.max(0, ...points.map((pt) => pt.v));
  const pad = Math.max((hi - lo) * 0.1, 5);
  const yMin = Math.max(0, lo - pad);
  const yMax = hi + pad;
  const W = 640;
  const H = 200;
  const y = (v: number) => 170 - ((v - yMin) / (yMax - yMin)) * 140;
  const x = (i: number) => (points.length > 1 ? (i * W) / (points.length - 1) : 0);
  const line = "M" + points.map((pt, i) => `${x(i).toFixed(1)},${y(pt.v).toFixed(1)}`).join(" L");
  const base = y(0);
  const area = `${line} L${W},${base.toFixed(1)} L0,${base.toFixed(1)} Z`;
  const up = last >= 0;
  const color = up ? "var(--bk-gold)" : "var(--down)";
  const fmtDay = (k: string) =>
    new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", { day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(`${k}T12:00:00Z`),
    );
  const usd = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;
  const ticks = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-[var(--line)] bg-[var(--card)] px-5 py-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[14px] font-extrabold text-[var(--ink)]">{title}</div>
        <div className="ltr-num text-[20px] font-extrabold" style={{ color }}>
          {usd(last)}
          {/* Against the $100 actually at risk: one basket's stake, rolled night to night. */}
          <span className="ms-1.5 text-[12px] font-bold text-[var(--faint)]">/ ${CHART_STAKE_PER_BASKET}</span>
        </div>
      </div>
      <div className="text-[11px] text-[var(--faint)]">{meta.replace("{date}", fmtDay(points[0]!.day))}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" style={{ direction: "ltr" }}>
        <line x1={0} y1={base} x2={W} y2={base} stroke="var(--line)" strokeWidth={1} strokeDasharray="4 5" />
        <text x={W - 4} y={base - 5} textAnchor="end" fontSize={10} fill="var(--faint)">
          $0
        </text>
        {hi > 0 && y(hi) < base - 18 && (
          <text x={W - 4} y={y(hi) - 6} textAnchor="end" fontSize={10} fill="var(--faint)">
            {usd(hi)}
          </text>
        )}
        <path d={area} fill={up ? "var(--bk-goldtint)" : "color-mix(in srgb, var(--down) 12%, transparent)"} />
        <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(points.length - 1)} cy={y(last)} r={4} fill={color} />
      </svg>
      <div dir="ltr" className="flex justify-between text-[11px] text-[var(--faint)]">
        {ticks.map((i) => (
          <span key={i}>{fmtDay(points[i]!.day)}</span>
        ))}
      </div>
    </div>
  );
}
