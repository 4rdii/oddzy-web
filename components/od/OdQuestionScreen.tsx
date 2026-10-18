import Link from "next/link";
import type { Market, PricePoint, QuestionSeries } from "@/lib/api";
import { chg, chgCol, fmtV, marketUrl, pct, SEC_SLUG, SUB_SECTION, word } from "@/lib/od";
import { OdChart } from "./OdChart";
import { CountryChips, InTheNews, RelatedProvider, RelatedQuestions, TradeBox } from "./OdQuestionParts";
import { OdFamily, PolyBadge, type FamView } from "./parts";

/**
 * oddzy.xyz question page (design: "Oddzy Question"): the question, its odds
 * and history, the other deadlines of the same question, the resolution
 * rules, and a trade box that hands off to the web app. Live extras (news,
 * related questions) load in the browser; see /api/od/related.
 */

const SEC_NAME = { war: "War & Geopolitics", pol: "Politics", eco: "Economy" } as const;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}${y !== new Date().getUTCFullYear() ? ` ’${String(y).slice(2)}` : ""}`;
}

/** "…through October 31?" → "Oct 31"; else the close date. */
function deadlineLabel(title: string, close: string | null): string {
  const m = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,?\s+(\d{4}))?/i.exec(title);
  if (m) {
    const mon = MON[["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(m[1].toLowerCase())];
    const y = m[3] ? Number(m[3]) : null;
    return `${mon} ${Number(m[2])}${y && y !== new Date().getUTCFullYear() ? ` ’${String(y).slice(2)}` : ""}`;
  }
  return shortDate(close) ?? "";
}

export function OdQuestionScreen({ market, history, series, slug }: { market: Market; history: PricePoint[]; series: QuestionSeries | null; slug: string }) {
  const yes = market.probability.yes * 100;
  const pts = history.filter((h) => h.yes !== null).map((h) => ({ day: h.day, p: (h.yes as number) * 100 }));
  // End the line on the live price.
  const today = new Date().toISOString().slice(0, 10);
  const past = pts.filter((p) => p.day.slice(0, 10) < today);
  const line = [...past.map((p) => p.p), yes];
  const days = [...past.map((p) => p.day), new Date().toISOString()];
  const prev = past.at(-1)?.p ?? null;
  const d = prev === null ? null : yes - prev;
  const resolved = market.status !== "active";

  const cat = market.category?.id ?? null;
  const sec = cat ? SUB_SECTION[cat] : undefined;

  // Other deadlines of the same question: the open ones around this one.
  let fam: FamView | null = null;
  if (series && series.members.length > 1) {
    const open = series.members.filter((m) => m.status === "active" || m.slug === slug);
    const i = Math.max(0, open.findIndex((m) => m.slug === slug));
    const pick = open.slice(Math.max(0, Math.min(i - 1, open.length - 4)), Math.max(0, Math.min(i - 1, open.length - 4)) + 4);
    if (pick.length > 1)
      fam = {
        key: series.key,
        t: "ladder",
        title: market.title.replace(/\s+(by|before|through|on|in)\s+[^?]*\??$/i, " $1…"),
        n: series.members.length,
        stops: pick.map((m) => ({
          id: m.slug,
          slug: m.slug,
          lab: deadlineLabel(m.title, m.close_time),
          p: (m.probability?.yes ?? 0) * 100,
          chg: null,
          url: marketUrl(m.slug),
          vol: m.volume.h24,
        })),
      };
  }

  const stat = (v: string, k: string, col?: string) => (
    <span style={{ display: "grid", gap: 2 }}>
      <b className="mono" style={{ fontWeight: 700, fontSize: 16, color: col }}>
        {v}
      </b>
      <span style={{ fontSize: 12, color: "var(--od-ink3)" }}>{k}</span>
    </span>
  );

  return (
    <RelatedProvider slug={slug}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(16px,3vw,32px)" }} className={resolved ? undefined : "od-q-pad"}>
        <div className="mono" style={{ padding: "24px 0 0", fontWeight: 600, fontSize: 11.5, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--od-ink3)" }}>
          {sec && (
            <>
              <Link href={`/topic/${SEC_SLUG[sec]}`}>{SEC_NAME[sec]}</Link> /{" "}
            </>
          )}
          {market.category && <Link href={`/topic/${market.category.id}`}>{market.category.name}</Link>}
        </div>
        <div className="od-q">
          <div style={{ minWidth: 0, display: "grid", gap: 24 }}>
            <div style={{ display: "grid", gap: 14 }}>
              <h1 className="serif" style={{ margin: 0, fontWeight: 500, fontSize: "clamp(30px,4vw,52px)", lineHeight: 1.05, letterSpacing: "-.02em", textWrap: "pretty" }}>
                {market.title}
              </h1>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <PolyBadge label="Polymarket market" />
                <CountryChips />
              </div>
            </div>
            {resolved ? (
              <div style={{ padding: 18, borderRadius: 16, border: "1px solid var(--od-line)", background: "var(--od-panel)", display: "grid", gap: 6 }}>
                <span className="kicker">Resolved</span>
                <b className="serif" style={{ fontWeight: 500, fontSize: 36, color: market.outcome === "YES" ? "var(--od-up)" : "var(--od-down)" }}>
                  {market.outcome === "YES" ? "Yes" : market.outcome === "NO" ? "No" : "Awaiting result"}
                </b>
                <span style={{ fontSize: 13, color: "var(--od-ink3)" }}>{fmtV(market.volume.total)} traded in total.</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "12px 28px", paddingBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <b className="mono" style={{ fontWeight: 700, fontSize: "clamp(56px,7vw,84px)", lineHeight: 0.9, letterSpacing: "-.05em" }}>
                    {pct(yes)}%
                  </b>
                  <span style={{ fontSize: 15, color: "var(--od-ink2)" }}>chance · {word(yes)}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 22, paddingBottom: 6 }}>
                  {stat(`${chg(d)} pts`, "24h", chgCol(d))}
                  {stat(fmtV(market.volume.h24), "24h volume")}
                  {stat(fmtV(market.volume.total), "total")}
                  {market.close_time && stat(shortDate(market.close_time) ?? "", "closes")}
                </div>
              </div>
            )}
            <div style={{ background: "var(--od-panel)", border: "1px solid var(--od-line)", borderRadius: 16, padding: 18 }}>
              <OdChart points={line} days={days} height={260} />
            </div>
            {fam && (
              <div style={{ display: "grid", gap: 10 }}>
                <h2 className="serif" style={{ margin: 0, fontWeight: 500, fontSize: 24, lineHeight: 1.1 }}>
                  Other deadlines
                </h2>
                <OdFamily f={fam} current={slug} />
              </div>
            )}
            <div style={{ display: "grid", gap: 10 }}>
              <h2 className="serif" style={{ margin: 0, fontWeight: 500, fontSize: 24, lineHeight: 1.1 }}>
                How this resolves
              </h2>
              {market.description ? (
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--od-ink2)", maxWidth: "68ch", whiteSpace: "pre-line" }}>{market.description}</p>
              ) : (
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--od-ink2)", maxWidth: "68ch" }}>
                  Resolves YES if the condition in the question is met by the close date, as reported by major outlets. Resolves NO otherwise.
                </p>
              )}
              <a href={market.url} rel="nofollow noopener" target="_blank" style={{ fontSize: 12.5, color: "var(--od-ink3)" }}>
                View this market on Polymarket ↗
              </a>
            </div>
            <InTheNews />
            <RelatedQuestions />
          </div>
          {!resolved && <TradeBox slug={slug} yes={yes} />}
        </div>
      </div>
    </RelatedProvider>
  );
}
