"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/app/LocaleProvider";
import { authedPost, ApiCallError } from "@/lib/client-api";
import { BasketCard, optionalAuthHeaders, type CommunityBasket } from "./BasketCard";

export type { CommunityBasket };

/**
 * The community basket feed.
 *
 * Reads from a PUBLIC endpoint that personalises only if a credential happens
 * to be present, so a logged-out visitor arriving on a shared link sees the
 * feed rather than a sign-in wall. Only the Follow button needs an account, and
 * it says so at the moment it is pressed instead of gating the whole page.
 */

const TABS = ["all", "hot", "following", "bought"] as const;
type Tab = (typeof TABS)[number];

export function CommunityFeed({
  initial,
  creatorSharePct,
}: {
  initial: CommunityBasket[];
  creatorSharePct: number;
}) {
  const { locale, t, rtl } = useLocale();
  const c = t.communityBaskets;

  const [tab, setTab] = useState<Tab>("all");
  const [rows, setRows] = useState<CommunityBasket[]>(initial);
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (next: Tab, signal?: AbortSignal) => {
    setLoading(true);
    try {
      // Not authedGet: this endpoint is public, and requiring a credential here
      // would make the feed blank for exactly the visitors it exists to reach.
      // The bot reads auth opportunistically to fill in follow state.
      const res = await fetch(`/api/webapp/v1/community-baskets?tab=${next}`, {
        signal,
        cache: "no-store",
        headers: await optionalAuthHeaders(),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { baskets?: CommunityBasket[]; signedIn?: boolean };
      setRows(data.baskets ?? []);
      setSignedIn(Boolean(data.signedIn));
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setRows([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(tab, ctrl.signal);
    return () => ctrl.abort();
  }, [tab, load]);

  /**
   * Optimistic follow.
   *
   * The row flips immediately and the count moves with it, then reconciles
   * against the server's authoritative number. On failure it snaps back — a
   * follow that appears to have worked and silently didn't is worse than one
   * that visibly fails, because the creator's count is the thing being claimed.
   */
  async function toggleFollow(b: CommunityBasket) {
    if (!b.creatorTgUserId) return;
    const wanted = !b.viewerFollows;
    const before = rows;

    setRows((prev) =>
      prev.map((r) =>
        r.creatorTgUserId === b.creatorTgUserId
          ? { ...r, viewerFollows: wanted, followers: Math.max(0, r.followers + (wanted ? 1 : -1)) }
          : r,
      ),
    );
    setNotice(null);

    try {
      const res = await authedPost<{ followers: number; following: boolean }>(
        "/webapp/v1/follow",
        { creatorTgUserId: b.creatorTgUserId, follow: wanted },
      );
      setRows((prev) =>
        prev.map((r) =>
          r.creatorTgUserId === b.creatorTgUserId
            ? { ...r, viewerFollows: res.following, followers: res.followers }
            : r,
        ),
      );
    } catch (e) {
      setRows(before);
      const err = e as ApiCallError;
      setNotice(err.kind === "unauthenticated" || err.kind === "no_account" ? c.signInToFollow : c.followFailed);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {TABS.map((x) => {
          const on = x === tab;
          return (
            <button
              key={x}
              type="button"
              onClick={() => setTab(x)}
              className="rounded-full border px-3.5 py-1.5 text-[13px] font-semibold"
              style={{
                background: on ? "var(--bk-goldtint)" : "var(--card)",
                borderColor: on ? "#b08d2f" : "var(--line)",
                color: on ? "var(--bk-gold)" : "var(--mute)",
              }}
            >
              {c.tabs[x]}
            </button>
          );
        })}
      </div>

      {notice && (
        <p className="mb-4 rounded-lg bg-[var(--bk-goldtint)] p-2.5 text-[13px] text-[var(--bk-warn)]">
          {notice}
        </p>
      )}

      {loading && rows.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-[var(--faint)]">{c.loading}</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-8 text-center">
          <p className="text-[14px] text-[var(--mute)]">
            {tab === "following" && !signedIn ? c.emptyFollowingSignedOut
              : tab === "following" ? c.emptyFollowing
              : c.empty}
          </p>
          <a
            href={`/${locale}/baskets/new`}
            className="mt-4 inline-block rounded-xl px-4 py-2.5 text-[14px] font-bold"
            style={{
              background: "var(--bk-cta)",
              color: "var(--bk-cta-ink)",
              boxShadow: "var(--bk-cta-shadow)",
            }}
          >
            {c.newBasket}
          </a>
        </div>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]">
          {rows.map((b) => (
            <BasketCard key={b.slug} basket={b} onToggleFollow={toggleFollow} />
          ))}
        </div>
      )}

      {/* Explainer band */}
      <section
        className="mt-10 rounded-2xl border p-6"
        style={{ borderColor: "var(--bk-goldborder)", background: "var(--bk-goldtint)" }}
      >
        <h2 className="text-[17px] font-extrabold text-[var(--ink)]">{c.explainerTitle}</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {[c.step1, c.step2, c.step3.replace("{pct}", String(creatorSharePct))].map((step, i) => (
            <li key={i} className="text-[13px] leading-relaxed text-[var(--text2)]">
              <span
                dir="ltr"
                className="mb-1 block text-[12px] font-extrabold"
                style={{ color: "var(--bk-gold)" }}
              >
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
