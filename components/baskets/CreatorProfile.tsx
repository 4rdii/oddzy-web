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
 * Every number is real: win rate from settled legs, return and the chart from
 * settled buyer picks, fees from the sharer accrual. Where there is no data
 * yet the card shows a dash — the design's +15.2% is a mock, and rendering an
 * invented figure in its place would be worse than an empty one.
 */

type Creator = {
  id: string | null;
  name: string | null;
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
  const name = isHouse
    ? housePersona ? c.personas[housePersona] : brand.name
    : (creator.name ?? c.anonymous);
  const initial = (creator.name ?? "?").replace(/^@/, "").charAt(0).toUpperCase();

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
      {perf && perf.monthly.length >= 2 && (
        <ReturnChart monthly={perf.monthly} title={p.cumulativeReturn} meta={p.chartMeta} locale={locale} />
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

      {/* Track record — the archived baskets, one row each. The right-hand
          figure is the buyers' realized return where anyone actually bought;
          otherwise the hit count, which is the only honest number left. */}
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
                const good = pl != null ? pl >= 0 : settled > 0 && won * 2 >= settled;
                const when = b.publishedAt
                  ? new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    }).format(new Date(b.publishedAt))
                  : null;
                return (
                  <div
                    key={b.slug}
                    className="flex items-center justify-between gap-3.5 px-[18px] py-3.5"
                    style={{ borderTop: i === 0 ? "none" : "1px solid var(--line)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold text-[var(--ink)]">
                        {localized(locale, b.titleEn, b.titleFa)}
                      </div>
                      <div className="mt-0.5 text-[12px] text-[var(--mute)]">
                        {when}
                        {when && settled > 0 && pl != null && ` · ${hit}`}
                      </div>
                    </div>
                    <div
                      className="whitespace-nowrap text-[13px] font-extrabold tabular-nums"
                      style={{
                        color:
                          settled === 0
                            ? "var(--faint)"
                            : good
                              ? "var(--bk-green)"
                              : "var(--down)",
                      }}
                    >
                      {pl != null ? signedPct(pl) : settled > 0 ? hit : c.closed}
                    </div>
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

/**
 * The cumulative-return line, drawn from realized monthly buckets: each
 * month's point is total PnL over total stake up to and including that month,
 * so the line answers "how has $1 given to this creator done so far".
 */
function ReturnChart({
  monthly,
  title,
  meta,
  locale,
}: {
  monthly: Perf["monthly"];
  title: string;
  meta: string;
  locale: string;
}) {
  let stake = 0;
  let pnl = 0;
  const points = monthly.map((m) => {
    stake += m.stakeUsdc;
    pnl += m.pnlUsdc;
    return { month: m.month, v: stake > 0 ? (pnl / stake) * 100 : 0 };
  });

  const lo = Math.min(0, ...points.map((pt) => pt.v));
  const hi = Math.max(1, ...points.map((pt) => pt.v));
  const pad = (hi - lo) * 0.1;
  const yMin = lo - pad;
  const yMax = hi + pad;
  const W = 640;
  const H = 200;
  const y = (v: number) => 170 - ((v - yMin) / (yMax - yMin)) * 140;
  const x = (i: number) => (points.length > 1 ? (i * W) / (points.length - 1) : 0);

  const line = "M" + points.map((pt, i) => `${x(i).toFixed(1)},${y(pt.v).toFixed(1)}`).join(" L");
  const area = `${line} L${W},${y(Math.max(yMin, 0)).toFixed(1)} L0,${y(Math.max(yMin, 0)).toFixed(1)} Z`;
  const grid = [yMin + (yMax - yMin) * 0.15, (yMin + yMax) / 2, yMax - (yMax - yMin) * 0.15];

  const monthLabel = (ym: string) => {
    const [yr, mo] = ym.split("-").map(Number);
    return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", { month: "short" }).format(
      new Date(Date.UTC(yr!, (mo ?? 1) - 1, 15)),
    );
  };

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-[var(--line)] bg-[var(--card)] px-5 py-[18px]">
      <div className="flex items-baseline justify-between">
        <div className="text-[14px] font-extrabold text-[var(--ink)]">{title}</div>
        <div className="text-[11px] text-[var(--faint)]">
          {meta.replace("{n}", String(points.length))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" style={{ direction: "ltr" }}>
        {grid.map((g, i) => (
          <g key={i}>
            <line x1={0} y1={y(g)} x2={W} y2={y(g)} stroke="var(--line)" strokeWidth={1} />
            <text x={W - 4} y={y(g) - 5} textAnchor="end" fontSize={10} fill="var(--faint)">
              {signedPct(g)}
            </text>
          </g>
        ))}
        <path d={area} fill="var(--bk-goldtint)" />
        <path
          d={line}
          fill="none"
          stroke="var(--bk-gold)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={x(points.length - 1)}
          cy={y(points[points.length - 1]!.v)}
          r={4}
          fill="var(--bk-gold)"
        />
      </svg>
      <div dir="ltr" className="flex justify-between text-[11px] text-[var(--faint)]">
        {points.map((pt) => (
          <span key={pt.month}>{monthLabel(pt.month)}</span>
        ))}
      </div>
    </div>
  );
}
