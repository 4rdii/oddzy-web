import type { PricePoint } from "@/lib/api";

/**
 * Probability over time, as an inline SVG sparkline.
 *
 * This is the part of the page nobody can copy. A news site can quote today's
 * number off us, but "این احتمال یک ماه پیش ۶۷٪ بود" can only be written by
 * someone who was recording all along — and there is no backfill for a price
 * that was never stored.
 *
 * Server-rendered SVG rather than a chart library: it is a polyline, it must be
 * in the HTML for a crawler to see it, and shipping a charting bundle to render
 * thirty points would cost more than the page.
 */
export function PriceHistory({
  history,
  lang,
  labels,
}: {
  history: PricePoint[];
  lang: string;
  labels: { heading: string; since: string; empty: string; now: string };
}) {
  const points = history.filter((h): h is PricePoint & { yes: number } => h.yes !== null);

  // One point is not a history. Saying so is better than drawing a flat line
  // that implies the probability never moved.
  if (points.length < 2) {
    return (
      <section className="mt-8">
        <h2 className="text-[17px] font-bold tracking-[-0.01em]">{labels.heading}</h2>
        <p className="mt-2 text-[13px] text-[var(--mute)]">{labels.empty}</p>
      </section>
    );
  }

  const W = 640;
  const H = 140;
  const PAD = 6;
  const first = points[0]!;
  const last = points[points.length - 1]!;

  // Fixed 0-100% scale, not min/max of the window. Autoscaling would make a
  // 2-point wobble look like a collapse, which is exactly the misreading this
  // page exists to prevent.
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - v) * (H - PAD * 2);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.yes).toFixed(1)}`).join(" ");
  const area = `${d} L${x(points.length - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "fa" ? "fa-IR" : "en-US", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  return (
    <section className="mt-8">
      <h2 className="text-[17px] font-bold tracking-[-0.01em]">{labels.heading}</h2>
      <p className="mt-2 text-[13px] text-[var(--mute)]">
        {labels.since.replace("{date}", fmt(first.day)).replace("{pct}", String(Math.round(first.yes * 100)))}
      </p>

      {/* dir=ltr: time runs left-to-right in both locales — mirroring a time
          axis in RTL would put the newest point on the left and read as a fall
          when the price rose. */}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--line)] p-3" dir="ltr">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[140px] w-full"
          role="img"
          aria-label={labels.heading}
          preserveAspectRatio="none"
        >
          <path d={area} fill="var(--up)" opacity="0.12" />
          <path d={d} fill="none" stroke="var(--up)" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>

      <p className="mt-2 flex justify-between font-mono text-[11px] text-[var(--faint)]" dir="ltr">
        <span>{fmt(first.day)}</span>
        <span>
          {labels.now} <span className="ltr-num">{Math.round(last.yes * 100)}%</span>
        </span>
      </p>
    </section>
  );
}
