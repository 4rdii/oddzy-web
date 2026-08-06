import Link from "next/link";
import type { SeriesMember } from "@/lib/api";
import type { Locale } from "@/lib/i18n";
import { compactUsd, deadlineDate, localized, pct } from "@/lib/format";

type Labels = {
  timelineHeading: string;
  timelineLead: string;
  open: string;
  awaiting: string;
  resolvedYes: string;
  resolvedNo: string;
  resolvedUnknown: string;
  current: string;
};

/**
 * Every deadline this question has run through, oldest first.
 *
 * This is the payload that justifies consolidating the family onto one URL: a
 * single market page can only say "17%", while the family can say "it was asked
 * five times, resolved No four times, and is at 17% for the current deadline".
 * That is the thing no Persian-language source publishes.
 */
export function SeriesTimeline({
  members,
  lang,
  labels,
}: {
  members: SeriesMember[];
  lang: Locale;
  labels: Labels;
}) {
  if (members.length < 2) return null;

  const now = Date.now();

  return (
    <section className="mt-8">
      <h2 className="text-[17px] font-bold tracking-[-0.01em]">{labels.timelineHeading}</h2>
      <p className="mt-2 text-[13px] text-[var(--mute)]">{labels.timelineLead}</p>

      <ol className="mt-4 overflow-hidden rounded-2xl border border-[var(--line)]">
        {members.map((m) => {
          const resolved = m.status !== "active";
          const isYes = m.outcome === "YES";
          // Past its deadline but not settled yet: settlement lags the date, and
          // claiming "Yes"/"No" before the oracle has spoken would be a guess.
          const pastDue =
            !resolved && m.close_time !== null && new Date(m.close_time).getTime() < now;

          const verdict = resolved
            ? m.outcome === null
              ? labels.resolvedUnknown
              : isYes
                ? labels.resolvedYes
                : labels.resolvedNo
            : pastDue
              ? labels.awaiting
              : m.probability
                ? `${pct(m.probability.yes)}%`
                : labels.open;

          const tone = resolved
            ? isYes
              ? "text-[var(--up)]"
              : m.outcome === null
                ? "text-[var(--mute)]"
                : "text-[var(--down)]"
            : pastDue
              ? "text-[var(--mute)]"
              : "text-[var(--up)]";

          return (
            <li
              key={m.slug}
              className={`flex items-center justify-between gap-4 border-b border-[var(--line)] px-4 py-3.5 last:border-b-0 ${
                m.current ? "bg-[var(--card)]" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block text-[14px] font-medium">
                  <span className="ltr-num">{deadlineDate(m.close_time, lang)}</span>
                  {m.current && (
                    <span className="ms-2 rounded-md bg-[var(--accent)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--on-accent)]">
                      {labels.current}
                    </span>
                  )}
                </span>
                {/* The full title stays visible: the deadline is the only thing
                    that differs between legs, so hiding it would make the rows
                    look interchangeable when they are not. */}
                <Link
                  href={`/market/${m.slug}`}
                  className="mt-0.5 block truncate text-[12px] text-[var(--mute)] underline"
                >
                  {localized(lang, m.title, m.title_fa)}
                </Link>
              </span>
              <span className="shrink-0 text-end">
                <span className={`block font-mono text-[15px] font-bold ${tone}`}>
                  <span className="ltr-num">{verdict}</span>
                </span>
                <span className="block font-mono text-[10px] text-[var(--faint)]">
                  <span className="ltr-num">{compactUsd(m.volume.total)}</span>
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
