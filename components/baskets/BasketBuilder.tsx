"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/app/LocaleProvider";
import { authedPost, ApiCallError } from "@/lib/client-api";
import { localized } from "@/lib/format";
import type { Market } from "@/lib/api";
import { childrenOf, type Topic } from "@/lib/taxonomy";

/**
 * The basket builder: pick 2–10 markets, weight them, publish under your name.
 *
 * WEIGHTS ARE WHOLE PERCENTS HERE, basis points on the wire. The UI works in
 * integers 1..100 because a slider and a number input both want them, and the
 * server's unit is bps (10000 = 100%), so the boundary multiplies by 100 on the
 * way out and never the other way. Keeping percents out of the API and bps out
 * of the UI is what stops a 0.5% rounding drift from reaching the sizing math.
 *
 * The client validates only to keep the button honest. Every rule that decides
 * whether money can move — weights summing, per-leg minimums, closed legs, the
 * min-stake ceiling — is re-run server-side by the same `parseBasketSpec` +
 * `checkBasketRules` pair the config seeder uses. Anything this component
 * decides is a courtesy, not a gate.
 */

/** Per-leg colours for the weight bar, in the handoff's order. */
const LEG_COLORS = [
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

const MIN_LEGS = 2;
const MAX_LEGS = 10;

/**
 * Legs must resolve within this many days of each other.
 *
 * Mirrors MAX_HORIZON_DAYS in packages/domain/src/basket-spec.ts, which is the
 * authority — the server rejects a wider basket at publish. It is duplicated
 * here rather than fetched because the alternative is worse: without it the
 * builder happily lets someone weight a September Fed market against a 2027
 * geopolitical one, and the only feedback is a rejection AFTER they have named
 * and submitted it. A rule the client cannot see is a rule the client will
 * break.
 *
 * The reason the rule exists: a basket is bought as one decision, and legs that
 * settle a quarter apart mean most of the money is locked long after the rest
 * has resolved. That is a different product from the one the payout line
 * describes.
 */
const MAX_HORIZON_DAYS = 31;
const DAY_MS = 86_400_000;

type Pick = { slug: string; weight: number };

/**
 * Even split with the remainder on the first leg.
 *
 * Matches the design's `equalWeights` exactly rather than the largest-remainder
 * method the server uses when weights are omitted. That divergence is fine and
 * deliberate: this component always SENDS explicit weights, so the server's
 * fallback never runs on anything built here. What matters is that the visible
 * number and the submitted number are the same, which they are.
 */
function equalWeights(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(100 / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? 100 - base * (n - 1) : base));
}

export function BasketBuilder({
  topics,
  /**
   * The creator's cut, as a percentage OF THE PLATFORM FEE — not of stake.
   * Read from config by the server page rather than written into the copy, so
   * the number a creator is promised here cannot drift from the number
   * `accrueRevShare` actually pays them.
   */
  creatorSharePct,
}: {
  topics: Topic[];
  creatorSharePct: number;
}) {
  const { locale, t, rtl } = useLocale();
  const c = t.basketBuilder;

  /**
   * Drill-down state, mirroring BrowseScreen exactly.
   *
   * `path` is the breadcrumb trail; `catId` is the node whose markets are
   * actually loaded. They are separate because the two things diverge: drilling
   * into "Football" should keep showing football markets while you choose
   * between its leagues, rather than blanking the list until you reach a leaf.
   * Flat top-level pills were the first cut and made anything below the first
   * tier unreachable — you could not build a basket out of two specific
   * leagues, which is most of what a football basket is.
   */
  const [path, setPath] = useState<Topic[]>([]);
  const [catId, setCatId] = useState<string>(topics[0]?.id ?? "");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [picked, setPicked] = useState<Pick[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ slug: string } | null>(null);

  /**
   * Markets stay in a map keyed by slug, separate from the visible list.
   * A pick has to survive switching categories — you build a basket by taking
   * one football market and one crypto market, and the football row is gone
   * from `markets` by the time you weight it. Without this the basket panel
   * would blank half its rows the moment you changed the filter.
   */
  const [known, setKnown] = useState<Record<string, Market>>({});

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!catId) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoadingMarkets(true);

    fetch(`/api/markets?category=${encodeURIComponent(catId)}&limit=40`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { markets?: Market[] } | null) => {
        const rows = d?.markets ?? [];
        setMarkets(rows);
        setKnown((prev) => {
          const next = { ...prev };
          for (const m of rows) next[m.slug] = m;
          return next;
        });
      })
      .catch(() => {
        // An aborted fetch is a category change, not a failure. A real failure
        // leaves the previous list up, which is more useful than an empty pane.
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadingMarkets(false);
      });

    return () => ctrl.abort();
  }, [catId]);

  const pickedSlugs = useMemo(() => new Set(picked.map((p) => p.slug)), [picked]);

  const addMarket = useCallback(
    (slug: string) => {
      setPicked((prev) => {
        if (prev.some((p) => p.slug === slug) || prev.length >= MAX_LEGS) return prev;
        const next = [...prev, { slug, weight: 0 }];
        const eq = equalWeights(next.length);
        return next.map((p, i) => ({ ...p, weight: eq[i] }));
      });
      setOver(false);
      setDragging(null);
      setError(null);
    },
    [],
  );

  const removeMarket = useCallback((slug: string) => {
    setPicked((prev) => prev.filter((p) => p.slug !== slug));
    setError(null);
  }, []);

  const setWeight = useCallback((slug: string, raw: number) => {
    const v = Math.max(1, Math.min(100, Math.round(raw) || 1));
    setPicked((prev) => prev.map((p) => (p.slug === slug ? { ...p, weight: v } : p)));
  }, []);

  const equalize = useCallback(() => {
    setPicked((prev) => {
      const eq = equalWeights(prev.length);
      return prev.map((p, i) => ({ ...p, weight: eq[i] }));
    });
  }, []);

  const sum = picked.reduce((a, p) => a + p.weight, 0);

  /**
   * Best case if every leg resolves YES: each leg's stake buys `1/price`
   * dollars of payout, so the multiplier is Σ (weight/100) / price.
   *
   * A leg whose price we don't have yet is skipped rather than treated as
   * certain — counting it as 1.0 would quietly understate the multiplier, and
   * an optimistic number here is the one kind of wrong that costs a user money.
   */
  const multiplier = useMemo(() => {
    let total = 0;
    for (const p of picked) {
      const price = known[p.slug]?.probability?.yes;
      if (!price || price <= 0) continue;
      total += p.weight / 100 / price;
    }
    return total;
  }, [picked, known]);

  /**
   * Widest gap between any two legs' resolution dates, in days.
   *
   * Legs with no close date (season outrights carry a NULL) are skipped rather
   * than treated as today — counting a missing date as now() would invent a
   * spread that isn't there and block a legitimate basket.
   */
  const horizonDays = useMemo(() => {
    const times = picked
      .map((p) => known[p.slug]?.close_time)
      .filter((x): x is string => Boolean(x))
      .map((x) => new Date(x).getTime())
      .filter((n) => Number.isFinite(n));
    if (times.length < 2) return 0;
    return (Math.max(...times) - Math.min(...times)) / DAY_MS;
  }, [picked, known]);

  const horizonOk = horizonDays <= MAX_HORIZON_DAYS;

  const canPublish =
    picked.length >= MIN_LEGS && sum === 100 && horizonOk && name.trim().length > 0;

  const publishLabel =
    picked.length < MIN_LEGS ? c.needTwo
    : sum !== 100 ? c.needHundred
    : !horizonOk ? c.needHorizon
    : !name.trim() ? c.needName
    : c.publish;

  async function publish() {
    if (!canPublish || publishing) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await authedPost<{ slug: string }>("/webapp/v1/baskets", {
        name: name.trim(),
        legs: picked.map((p) => ({
          slug: p.slug,
          side: "YES",
          // Percent → basis points. The only place this conversion happens.
          weightBps: p.weight * 100,
        })),
      });
      setDone({ slug: res.slug });
    } catch (e) {
      const err = e as ApiCallError & { serverMessage?: string; serverErrors?: string[] };
      // The server's rule failures are specific and actionable ("leg 3 has
      // closed"); a generic "something went wrong" would send someone back to
      // guess which of ten legs is the problem.
      setError(
        err.serverErrors?.length ? err.serverErrors.join(" · ")
        : err.serverMessage ? err.serverMessage
        : err.kind === "unauthenticated" ? c.signInFirst
        : err.kind === "rate_limited" ? c.tooFast
        : c.publishFailed,
      );
    } finally {
      setPublishing(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-[560px] rounded-2xl border border-[var(--bk-goldborder)] bg-[var(--bk-goldtint)] p-8 text-center">
        <div className="text-[24px] font-extrabold text-[var(--ink)]">{c.publishedTitle}</div>
        <p className="mt-2 text-[14px] text-[var(--mute)]">{c.publishedBody}</p>
        <a
          href={`/basket/${done.slug}`}
          className="mt-5 inline-block rounded-xl px-5 py-3 text-[15px] font-bold"
          style={{
            background: "var(--bk-cta)",
            color: "var(--bk-cta-ink)",
            boxShadow: "var(--bk-cta-shadow)",
          }}
        >
          {c.viewBasket}
        </a>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(330px,420px)]">
      {/* ── Market library ─────────────────────────────────────────────── */}
      <section>
        {/* Breadcrumbs — same interaction as the markets page. */}
        <nav className="mb-2 flex flex-wrap items-center gap-1.5" aria-label={c.pathLabel}>
          <button
            type="button"
            onClick={() => {
              setPath([]);
              setCatId(topics[0]?.id ?? "");
            }}
            className="rounded-full border px-2.5 py-1 text-[12px] font-semibold"
            style={{
              background: path.length === 0 ? "var(--bk-goldtint)" : "var(--card)",
              borderColor: path.length === 0 ? "#b08d2f" : "var(--line)",
              color: path.length === 0 ? "var(--bk-gold)" : "var(--mute)",
            }}
          >
            {c.allCategories}
          </button>
          {path.map((node, i) => (
            <button
              key={node.id}
              type="button"
              onClick={() => {
                setPath(path.slice(0, i + 1));
                setCatId(node.id);
              }}
              className="rounded-full border px-2.5 py-1 text-[12px] font-semibold"
              style={{
                background: i === path.length - 1 ? "var(--bk-goldtint)" : "var(--card)",
                borderColor: i === path.length - 1 ? "#b08d2f" : "var(--line)",
                color: i === path.length - 1 ? "var(--bk-gold)" : "var(--mute)",
              }}
            >
              {localized(locale, node.name, node.name_fa)}
            </button>
          ))}
        </nav>

        {/* Children of the current node. A node with its own children drills;
            a leaf just filters. Both also load that node's markets, so the list
            below is never empty while you are still choosing. */}
        <div className="mb-3 flex flex-wrap gap-2">
          {childrenOf(topics, path).map((topic) => {
            const on = topic.id === catId;
            const hasKids = topic.children.length > 0;
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => {
                  setCatId(topic.id);
                  if (hasKids) setPath([...path, topic]);
                }}
                className="rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors"
                style={{
                  background: on ? "var(--bk-goldtint)" : "var(--card)",
                  borderColor: on ? "#b08d2f" : "var(--line)",
                  color: on ? "var(--bk-gold)" : "var(--mute)",
                }}
              >
                {topic.emoji ? `${topic.emoji} ` : ""}
                {localized(locale, topic.name, topic.name_fa)}{" "}
                <span dir="ltr" className="tabular-nums opacity-70">
                  {topic.active_markets}
                </span>
                {hasKids && (
                  <span aria-hidden className="opacity-50">
                    {" "}›
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {loadingMarkets && markets.length === 0 ? (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-6 text-center text-[13px] text-[var(--faint)]">
              {c.loading}
            </div>
          ) : markets.length === 0 ? (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-6 text-center text-[13px] text-[var(--faint)]">
              {c.emptyCategory}
            </div>
          ) : (
            markets.map((m) => {
              const inBasket = pickedSlugs.has(m.slug);
              const full = picked.length >= MAX_LEGS;
              return (
                <div
                  key={m.slug}
                  draggable={!inBasket}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", m.slug);
                    setDragging(m.slug);
                  }}
                  onDragEnd={() => setDragging(null)}
                  className="flex items-center gap-3 rounded-xl border bg-[var(--card)] p-3 transition-opacity"
                  style={{
                    opacity: inBasket ? 0.45 : 1,
                    borderColor: inBasket ? "var(--btn)" : "var(--line)",
                  }}
                >
                  <span aria-hidden className="cursor-grab text-[var(--dots)] select-none">
                    ⠿
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-[var(--ink)]">
                      {localized(locale, m.title, m.title_fa)}
                    </div>
                    <div
                      dir="ltr"
                      className="mt-0.5 flex gap-2 text-[12px] tabular-nums text-[var(--faint)]"
                      style={{ justifyContent: rtl ? "flex-end" : "flex-start" }}
                    >
                      <span style={{ color: "var(--bk-green)" }}>YES</span>
                      <span>{Math.round((m.probability?.yes ?? 0) * 100)}%</span>
                      {m.close_time && (
                        <span className="text-[var(--dots)]">
                          {new Date(m.close_time).toLocaleDateString(
                            locale === "fa" ? "fa-IR" : "en-US",
                            { month: "short", day: "numeric" },
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addMarket(m.slug)}
                    disabled={inBasket || full}
                    aria-label={inBasket ? c.added : c.add}
                    className="h-8 w-8 shrink-0 rounded-lg border text-[15px] font-bold disabled:cursor-not-allowed"
                    style={{
                      background: inBasket ? "var(--bk-goldtint)" : "var(--btn)",
                      borderColor: inBasket ? "#b08d2f" : "var(--line)",
                      color: inBasket ? "var(--bk-gold)" : "var(--text2)",
                    }}
                  >
                    {inBasket ? "✓" : "+"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ── Basket panel ───────────────────────────────────────────────── */}
      <section className="lg:sticky lg:top-5 lg:self-start">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-[15px] font-extrabold text-[var(--ink)]">
              {c.yourBasket}{" "}
              <span dir="ltr" className="tabular-nums text-[var(--mute)]">
                ({picked.length}/{MAX_LEGS})
              </span>
            </div>
            {picked.length > 0 && (
              <button
                type="button"
                onClick={equalize}
                className="rounded-full border border-[var(--line)] bg-[var(--btn)] px-3 py-1 text-[12px] font-semibold text-[var(--text2)]"
              >
                {c.splitEvenly}
              </button>
            )}
          </div>

          {/* Drop zone. The "+" button is the equivalent affordance — drag is an
              enhancement, and there is no drag on touch. */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!over) setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              const slug = e.dataTransfer.getData("text/plain");
              if (slug) addMarket(slug);
            }}
            className="rounded-xl border-2 border-dashed p-3 transition-colors"
            style={{
              borderColor: over || dragging ? "#b08d2f" : "var(--line)",
              background: over ? "var(--bk-goldtint)" : "transparent",
            }}
          >
            {picked.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-[var(--faint)]">
                {c.dropHere}
                <div className="mt-1 text-[12px]">{c.dropHint}</div>
              </div>
            ) : (
              <div className="space-y-3">
                {picked.map((p, i) => {
                  const m = known[p.slug];
                  return (
                    <div key={p.slug} className="rounded-lg bg-[var(--paper)] p-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1 text-[13px] font-semibold text-[var(--ink)]">
                          {m ? localized(locale, m.title, m.title_fa) : p.slug}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMarket(p.slug)}
                          aria-label={c.remove}
                          className="shrink-0 px-1 text-[14px] text-[var(--faint)] hover:text-[#e0705a]"
                        >
                          ✕
                        </button>
                      </div>
                      <div dir="ltr" className="mt-2 flex items-center gap-2">
                        <input
                          type="range"
                          min={1}
                          max={100}
                          value={p.weight}
                          onChange={(e) => setWeight(p.slug, Number(e.target.value))}
                          className="h-1 flex-1 accent-[#d9b356]"
                          aria-label={c.weight}
                        />
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={p.weight}
                          onChange={(e) => setWeight(p.slug, Number(e.target.value))}
                          className="w-14 rounded-md border border-[var(--line)] bg-[var(--card)] px-2 py-1 text-right text-[12px] tabular-nums text-[var(--ink)]"
                          aria-label={c.weight}
                        />
                        <span className="text-[12px] text-[var(--faint)]">%</span>
                      </div>
                      <div
                        className="mt-2 h-[3px] rounded-full"
                        style={{
                          width: `${p.weight}%`,
                          background: LEG_COLORS[i % LEG_COLORS.length],
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {picked.length > 0 && (
            <>
              {/* Segmented weight bar */}
              <div dir="ltr" className="mt-4 flex h-[14px] gap-[3px] overflow-hidden rounded-[7px]">
                {picked.map((p, i) => (
                  <div
                    key={p.slug}
                    className="transition-[flex-grow] duration-200"
                    style={{
                      flexGrow: p.weight,
                      flexBasis: 0,
                      background: LEG_COLORS[i % LEG_COLORS.length],
                    }}
                  />
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between text-[13px]">
                <span className="text-[var(--mute)]">{c.totalWeight}</span>
                <span
                  dir="ltr"
                  className="font-extrabold tabular-nums"
                  style={{ color: sum === 100 ? "var(--bk-green)" : "var(--bk-warn)" }}
                >
                  {sum}%
                </span>
              </div>

              {multiplier > 0 && (
                <div className="mt-1 flex items-center justify-between text-[13px]">
                  <span className="text-[var(--mute)]">{c.bestCase}</span>
                  <span dir="ltr" className="font-extrabold tabular-nums text-[var(--bk-gold)]">
                    ×{multiplier.toFixed(2)}
                  </span>
                </div>
              )}

              {sum !== 100 && (
                <p className="mt-2 text-[12px]" style={{ color: "var(--bk-warn)" }}>
                  {c.weightWarning}
                </p>
              )}

              {!horizonOk && (
                <p className="mt-2 text-[12px]" style={{ color: "var(--bk-warn)" }}>
                  {c.horizonWarning.replace("{days}", String(MAX_HORIZON_DAYS))}
                </p>
              )}

              <input
                type="text"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder={c.namePlaceholder}
                className="mt-4 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--faint)]"
              />
            </>
          )}

          {error && (
            <p className="mt-3 rounded-lg bg-[var(--bk-goldtint)] p-2.5 text-[12px] text-[var(--bk-warn)]">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={publish}
            disabled={!canPublish || publishing}
            className="mt-4 w-full rounded-xl py-3 text-[15px] font-bold transition-[filter] hover:brightness-105"
            style={{
              background: canPublish ? "var(--bk-cta)" : "var(--btn)",
              color: canPublish ? "var(--bk-cta-ink)" : "var(--faint)",
              boxShadow: canPublish ? "var(--bk-cta-shadow)" : "none",
              cursor: canPublish ? "pointer" : "not-allowed",
            }}
          >
            {publishing ? c.publishing : publishLabel}
          </button>

          <p className="mt-2 text-center text-[11px] leading-relaxed text-[var(--faint)]">
            {c.feeNote.replace("{pct}", String(creatorSharePct))}
          </p>
        </div>
      </section>
    </div>
  );
}
