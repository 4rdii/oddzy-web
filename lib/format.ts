/** Display helpers shared by the app and site surfaces. */

/**
 * 0.7445 → 74 (whole-percent, as the prototype's probability chips show).
 *
 * Clamped to 1–99 for any live probability: a market at 0.45% would otherwise
 * render "0%", which reads as "impossible" and makes the paired side show
 * "100%" — a certainty neither price is claiming. Exact 0 and 1 (a resolved
 * market) pass through so a settled outcome still reads 0%/100%.
 */
export const pct = (p: number): number => {
  if (p <= 0) return 0;
  if (p >= 1) return 100;
  return Math.min(99, Math.max(1, Math.round(p * 100)));
};

/** 0.7445 → "74¢" — price framing, which is how a prediction market reads. */
export const cents = (p: number): string => `${pct(p)}¢`;

/** 18732073.61 → "$18.7M" */
export function compactUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toFixed(0)}`;
}

export function usd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** ISO → "Jul 29, 2026". Returns "—" for null/unparseable. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * ISO -> "August 15, 2026" / «۱۵ اوت ۲۰۲۶» — a market deadline, spelled out.
 *
 * The Persian form is pinned to the GREGORIAN calendar. Plain "fa-IR" would
 * render ۲۴ مرداد ۱۴۰۵ for the same instant, which contradicts the market's own
 * translated title («تا تاریخ ۱۵ اوت») and would read as two different
 * deadlines for one market. The translation worker refuses Jalali conversion
 * for exactly this reason; display has to make the same promise.
 */
export function deadlineDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale === "fa" ? "fa-IR-u-ca-gregory" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Wording for the countdown below. Supplied by the caller from the active
 * dictionary — the thresholds are shared, the phrasing is not.
 */
export type UntilCloseLabels = {
  unknown: string;
  closed: string;
  days: (n: number) => string;
  hours: (n: number) => string;
  soon: string;
};

const EN_UNTIL_CLOSE: UntilCloseLabels = {
  unknown: "—",
  closed: "closed",
  days: (n) => `in ${n} days`,
  hours: (n) => `in ${n}h`,
  soon: "under 1h",
};

/** "in 4 days" / "closed" — for the market card's resolution hint. */
export function untilClose(
  iso: string | null | undefined,
  labels: UntilCloseLabels = EN_UNTIL_CLOSE,
): string {
  if (!iso) return labels.unknown;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return labels.unknown;
  const ms = d - Date.now();
  if (ms <= 0) return labels.closed;
  const days = Math.floor(ms / 86_400_000);
  if (days >= 2) return labels.days(days);
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return labels.hours(hours);
  return labels.soon;
}

/**
 * Payout for a $stake position bought at `price` (0–1).
 * Each share costs `price` and pays $1 at resolution.
 */
export function payoutFor(stake: number, price: number): number {
  if (!price || price <= 0) return 0;
  return stake / price;
}

/**
 * Pick the field for the active locale, falling back to English.
 *
 * Every translated field on this API is nullable by design: the bot fills them
 * asynchronously, so a market can exist for minutes before its Persian title
 * does. Falling back beats blanking — a Persian reader would rather see the
 * English question than an empty row.
 */
export function localized(locale: string, en: string, fa: string | null | undefined): string {
  return locale === "fa" && fa ? fa : en;
}
