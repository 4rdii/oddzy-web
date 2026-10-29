import { TradeLink } from "./TradeLink";

/**
 * Two direct trade buttons — "Yes 63%" / "No 37%" — in place of a single
 * "trade this market" button. Each opens the site's trade pop-up on that side
 * (lib/trade-bus); /app stays the link fallback.
 */
export function YesNoTrade({
  slug,
  title,
  yes,
  labels,
  fa,
}: {
  slug: string;
  title?: string;
  /** YES probability 0–1, or null when unpriced. */
  yes: number | null;
  labels: { yes: string; no: string };
  fa: boolean;
}) {
  const pct = (p: number | null) => {
    if (p == null || !Number.isFinite(p)) return "";
    const v = Math.max(1, Math.min(99, Math.round(p * 100)));
    return fa ? `${String(v).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d])}٪` : `${v}%`;
  };
  const href = `/app?market=${encodeURIComponent(slug)}`;
  const base = "flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[16px] font-bold";
  return (
    <div className="mt-4 flex gap-3">
      <TradeLink href={href} req={{ slug, side: "YES", title, label: labels.yes }} className={`${base} bg-[color-mix(in_srgb,var(--up)_16%,transparent)] text-[var(--up)] ring-1 ring-[color-mix(in_srgb,var(--up)_45%,transparent)]`}>
        {labels.yes} <span className="ltr-num">{pct(yes)}</span>
      </TradeLink>
      <TradeLink href={href} req={{ slug, side: "NO", title, label: labels.no }} className={`${base} bg-[color-mix(in_srgb,var(--down)_14%,transparent)] text-[var(--down)] ring-1 ring-[color-mix(in_srgb,var(--down)_40%,transparent)]`}>
        {labels.no} <span className="ltr-num">{pct(yes == null ? null : 1 - yes)}</span>
      </TradeLink>
    </div>
  );
}
