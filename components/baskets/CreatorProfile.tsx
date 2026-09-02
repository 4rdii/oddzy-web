"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/app/LocaleProvider";
import { authedPost, ApiCallError } from "@/lib/client-api";
import {
  BasketCard,
  avatarColor,
  optionalAuthHeaders,
  type CommunityBasket,
} from "./BasketCard";

/**
 * A creator's public profile.
 *
 * The page a creator sends to people who don't have accounts, so it fetches
 * from the public endpoint and renders fully for a logged-out visitor. Only the
 * Follow button needs a credential, and it says so when pressed.
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
  /** House profile only — raw settled-leg record behind (or below) `accuracy`. */
  settledLegs?: number;
  wonLegs?: number;
};

export function CreatorProfile({ creatorId }: { creatorId: string }) {
  const { t, brand } = useLocale();
  const c = t.communityBaskets;
  const p = t.creatorProfile;

  const [creator, setCreator] = useState<Creator | null>(null);
  const [baskets, setBaskets] = useState<CommunityBasket[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [notice, setNotice] = useState<string | null>(null);

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
        const data = (await res.json()) as { creator: Creator; baskets: CommunityBasket[] };
        setCreator(data.creator);
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

  return (
    <div>
      <header className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[22px] font-bold text-white"
            style={{ background: isHouse ? "var(--bk-goldmuted)" : avatarColor(creator.id) }}
          >
            {isHouse ? "★" : initial}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 text-[20px] font-extrabold text-[var(--ink)]">
              {name}
              {(isHouse || creator.verified) && (
                <span aria-label={isHouse ? c.editorial : c.verified} style={{ color: "var(--bk-gold)" }}>
                  ✓
                </span>
              )}
            </h1>
            <p dir="ltr" className="mt-1 text-[13px] tabular-nums text-[var(--mute)]">
              {isHouse
                ? c.editorial
                : c.followersLabel.replace("{n}", String(creator.followers))}
              {" · "}
              {p.basketCount.replace("{n}", String(creator.basketCount))}
              {" · "}
              {c.buyers.replace("{n}", String(creator.totalBuys))}
              {creator.accuracy != null &&
                ` · ${Math.round(creator.accuracy * 100)}% ${c.accuracyLabel}`}
            </p>
            {/* The raw record, even below the accuracy floor: on the house
                page an absent number reads as a dodge, and "0 of 1" is a
                more credible sentence than a hidden stat. */}
            {isHouse && (creator.settledLegs ?? 0) > 0 && (
              <p className="mt-1 text-[13px] tabular-nums text-[var(--mute)]">
                {p.houseRecordLine
                  .replace("{won}", String(creator.wonLegs ?? 0))
                  .replace("{n}", String(creator.settledLegs ?? 0))}
              </p>
            )}
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

        {/* Accuracy is withheld below a floor of settled picks rather than shown
            as a flattering fraction. Saying so is the difference between a
            missing stat and a hidden one. */}
        {creator.accuracy == null && (
          <p className="mt-3 text-[12px] text-[var(--faint)]">{p.accuracyPending}</p>
        )}
      </header>

      {notice && (
        <p className="mt-4 rounded-lg bg-[var(--bk-goldtint)] p-2.5 text-[13px] text-[var(--bk-warn)]">
          {notice}
        </p>
      )}

      <h2 className="mt-8 mb-4 text-[16px] font-extrabold text-[var(--ink)]">
        {isHouse ? p.houseBaskets : p.theirBaskets}
      </h2>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]">
        {baskets.map((b) => (
          <BasketCard key={b.slug} basket={b} showCreator={false} />
        ))}
      </div>
    </div>
  );
}
