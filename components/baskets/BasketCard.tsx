"use client";

import { useLocale } from "@/components/app/LocaleProvider";
import { localized } from "@/lib/format";

/**
 * One community basket, as it appears in the feed and on a creator's profile.
 *
 * Shared by both so the two can never drift: a creator looking at their own
 * profile and a stranger looking at the feed must see the same follower count,
 * the same accuracy, and the same multiplier for the same basket. Two
 * implementations of this card would eventually disagree, and the number people
 * would notice disagreeing is the one attached to money.
 */

export type CommunityBasket = {
  slug: string;
  shortId: string;
  titleEn: string;
  titleFa: string | null;
  descriptionEn: string | null;
  descriptionFa: string | null;
  buyCount: number;
  legCount: number;
  creatorTgUserId: string | null;
  creatorName: string | null;
  creatorVerified: boolean;
  followers: number;
  accuracy: number | null;
  viewerFollows: boolean;
  /** House-endorsed. Editorial baskets are curated and carry no creator. */
  curated: boolean;
  /** Which editorial desk this is, derived server-side from the legs. */
  editorialPersona?: "daily" | "world" | null;
  /** 'published' | 'archived'. Profiles include archived rows as history. */
  status?: string;
  publishedAt?: string | null;
  /** Leg detail, present on profile responses only — the expandable record. */
  legs?: Array<{
    title: string;
    titleFa: string | null;
    side: "YES" | "NO";
    outcome: string | null;
  }>;
  /** The basket's own settled-leg record. */
  settledLegs?: number;
  wonLegs?: number;
  weightsBps: number[];
  multiplier: number | null;
};

export const LEG_COLORS = [
  "var(--bk-gold)",
  "#b08d2f",
  "#8a6f2a",
  "#6b5620",
  "#d9b356",
  "#a3853a",
  "#7d6a2e",
  "#5c4d1e",
  "#c9a44a",
  "#948038",
];

/**
 * Deterministic avatar colour from the creator id.
 *
 * Keyed on the id, not the display name: a name can change, and an avatar that
 * changes colour when someone edits their profile reads as a different person
 * in a feed you scroll by recognition.
 */
export function avatarColor(id: string | null): string {
  const palette = ["#b08d2f", "#5f7f9b", "#8a6f2a", "#7a5c8f", "#4f8a6b", "#a3653a"];
  if (!id) return palette[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function BasketCard({
  basket: b,
  onToggleFollow,
  onOpen,
  showCreator = true,
}: {
  basket: CommunityBasket;
  onToggleFollow?: (b: CommunityBasket) => void;
  /**
   * Open in place instead of navigating. The mini-app passes this: inside
   * Telegram a link to /baskets/<slug> would leave the buy flow, and the whole
   * point of the screen is that the next tap is a purchase.
   */
  onOpen?: (slug: string) => void;
  /** Off on a creator's own profile, where the header already says who they are. */
  showCreator?: boolean;
}) {
  const { locale, t, rtl, brand } = useLocale();
  const c = t.communityBaskets;

  /**
   * Editorial baskets have no creator row, so they render as the house rather
   * than as an anonymous user. They also get no Follow button — there is
   * nobody to follow, and a dead control on a card is worse than none. The
   * byline still links somewhere: `house-daily` / `house-world` are the
   * reserved editorial-desk ids (non-numeric, because both positive AND
   * negative integers are real account ids), and those pages hold the same
   * track record any human creator has to stand behind.
   */
  const isHouse = b.creatorTgUserId == null;
  const houseName = b.editorialPersona ? c.personas[b.editorialPersona] : brand.name;
  /**
   * A past basket (the expiry job archives one the moment no leg is still
   * buyable). It renders as a record, not an offer: the detail page only
   * serves published baskets, so the View link would 404, and the multiplier
   * is a quote for a purchase nobody can make any more.
   */
  const isPast = b.status === "archived";
  const creatorHref = `/creator/${
    isHouse ? (b.editorialPersona ? `house-${b.editorialPersona}` : "house") : b.creatorTgUserId
  }`;

  const title = localized(locale, b.titleEn, b.titleFa);
  const desc = localized(locale, b.descriptionEn ?? "", b.descriptionFa);
  const initial = (b.creatorName ?? "?").replace(/^@/, "").charAt(0).toUpperCase();

  return (
    <article className="flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--bk-goldborder)]">
      {showCreator && (
        <div className="flex items-center gap-2.5">
          <a
            href={creatorHref}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white"
            style={{ background: isHouse ? "var(--bk-goldmuted)" : avatarColor(b.creatorTgUserId) }}
            aria-hidden
          >
            {isHouse ? "★" : initial}
          </a>
          <div className="min-w-0 flex-1">
            <a
              href={creatorHref}
              className="flex items-center gap-1 truncate text-[13px] font-bold text-[var(--ink)]"
            >
              {isHouse ? houseName : (b.creatorName ?? c.anonymous)}
              {(isHouse || b.creatorVerified) && (
                <span
                  aria-label={isHouse ? c.editorial : c.verified}
                  style={{ color: "var(--bk-gold)" }}
                >
                  ✓
                </span>
              )}
            </a>
            <div
              dir="ltr"
              className="truncate text-[11px] text-[var(--faint)]"
              style={{ textAlign: rtl ? "right" : "left" }}
            >
              {isHouse
                ? c.editorial
                : c.followersLabel.replace("{n}", String(b.followers))}
              {!isHouse &&
                b.accuracy != null &&
                ` · ${Math.round(b.accuracy * 100)}% ${c.accuracyLabel}`}
            </div>
          </div>
          {onToggleFollow && !isHouse && (
            <button
              type="button"
              onClick={() => onToggleFollow(b)}
              className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
              style={{
                background: b.viewerFollows ? "var(--bk-goldtint)" : "transparent",
                borderColor: b.viewerFollows ? "#b08d2f" : "var(--line)",
                color: b.viewerFollows ? "var(--bk-gold)" : "var(--mute)",
              }}
            >
              {b.viewerFollows ? c.following : c.follow}
            </button>
          )}
        </div>
      )}

      <h3 className={`${showCreator ? "mt-3" : ""} text-[15px] leading-snug font-extrabold text-[var(--ink)]`}>
        {title}
      </h3>
      {desc && <p className="mt-1 line-clamp-2 text-[12px] text-[var(--mute)]">{desc}</p>}

      {b.weightsBps.length > 0 && (
        <div dir="ltr" className="mt-3 flex h-[8px] gap-[2px] overflow-hidden rounded-full">
          {b.weightsBps.map((w, i) => (
            <div
              key={i}
              style={{ flexGrow: w, flexBasis: 0, background: LEG_COLORS[i % LEG_COLORS.length] }}
            />
          ))}
        </div>
      )}

      <div
        dir="ltr"
        className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tabular-nums text-[var(--faint)]"
        style={{ justifyContent: rtl ? "flex-end" : "flex-start" }}
      >
        <span>{c.positions.replace("{n}", String(b.legCount))}</span>
        {!isPast && b.multiplier != null && (
          <>
            <span aria-hidden>·</span>
            <span style={{ color: "var(--bk-gold)", fontWeight: 700 }}>
              ×{b.multiplier.toFixed(2)}
            </span>
          </>
        )}
        <span aria-hidden>·</span>
        <span>{c.buyers.replace("{n}", String(b.buyCount))}</span>
      </div>

      {isPast ? (
        <p className="mt-3 text-[13px] font-bold tabular-nums" style={{ color: "var(--mute)" }}>
          {(b.settledLegs ?? 0) > 0
            ? c.recordChip
                .replace("{won}", String(b.wonLegs ?? 0))
                .replace("{n}", String(b.settledLegs ?? 0))
            : c.closed}
        </p>
      ) : onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(b.slug)}
          className="mt-3 text-start text-[13px] font-bold"
          style={{ color: "var(--bk-gold)" }}
        >
          {c.view} →
        </button>
      ) : (
        <a
          href={`/baskets/${b.slug}`}
          className="mt-3 text-[13px] font-bold"
          style={{ color: "var(--bk-gold)" }}
        >
          {c.view} →
        </a>
      )}
    </article>
  );
}

/**
 * Auth headers when we have them, none when we don't.
 *
 * Deliberately never throws. `authHeaders` in client-api rejects a caller with
 * no credential, which is right for a bet and wrong for a public feed — here a
 * missing credential is the normal case, not a failure.
 */
export async function optionalAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { getAccessToken } = await import("@privy-io/react-auth");
    const { getWebApp } = await import("@/lib/telegram");
    const initData = getWebApp()?.initData ?? "";
    if (initData) return { "X-Telegram-Init-Data": initData };
    const token = await getAccessToken().catch(() => null);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
