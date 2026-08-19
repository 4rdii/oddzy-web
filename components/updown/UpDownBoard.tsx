"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { UpDownWindow, SettledUpDownWindow } from "@/lib/api";
import { PriceChart, useWindowPrices, type PriceSeries } from "./PriceChart";

/**
 * The Up/Down desk: one focused market, with its neighbours in time along the
 * bottom and its sibling coins down the side.
 *
 * Client-rendered and polled, which is unusual for this site — every other page
 * is a static server render because it exists for crawlers. This one is the
 * opposite: it is a live instrument. A window lives fifteen minutes, so a server
 * render is stale before it reaches the browser.
 *
 * WHY ONE MARKET AND NOT A LIST. The previous board showed every open window
 * stacked vertically, which gave nine near-identical cards equal weight and left
 * the reader to work out which one they could actually act on. A viewer is
 * always looking at exactly one question — this coin, this window — so the page
 * commits to that: the chosen window gets the chart, the countdown and the
 * prices, and everything else becomes navigation.
 *
 * WHAT IS DELIBERATELY NOT PORTED from the reference design:
 *  - a 5-minute / 15-minute interval switch. We only run 15-minute windows, so
 *    the second tab would lead nowhere.
 *  - a working buy. Positions are opened in the bot and the mini-app; this page
 *    is the crawlable marketing surface. The amount row below is a payout
 *    calculator, labelled as one, and the button is the same Telegram CTA every
 *    other public page carries. Rendering a live-looking buy that silently does
 *    nothing would be worse than not showing one.
 */

const POLL_MS = 5000;

/** How many resolved and upcoming windows flank the live one in the timeline. */
const PAST_SLOTS = 2;
const FUTURE_SLOTS = 2;

/** Window length. Only 15-minute windows exist; see the note at the top. */
const WINDOW_SECONDS = 900;

/** Stake sizes in the payout row. Matches the sizes the bot offers. */
const AMOUNTS = [5, 25, 100];

type Coin = { glyph: string; color: string; decimals: number; name: string };

/**
 * Coin identity. The colours are each chain's own brand colour rather than
 * anything from our palette, and they are the one place on the page that does
 * not use a theme token — a coin is the same colour in day and night, and
 * readers recognise the mark faster than the ticker.
 */
const COINS: Record<string, Coin> = {
  BTC: { glyph: "₿", color: "#f7931a", decimals: 2, name: "Bitcoin" },
  ETH: { glyph: "Ξ", color: "#627eea", decimals: 2, name: "Ethereum" },
  SOL: { glyph: "◎", color: "#9945ff", decimals: 2, name: "Solana" },
};

const FALLBACK_COIN: Coin = { glyph: "◆", color: "var(--accent)", decimals: 2, name: "" };

/** Display order, so the coin list does not reshuffle as the API reorders. */
const COIN_ORDER = ["BTC", "ETH", "SOL"];

export type UpDownCopy = {
  none: string;
  closesIn: string;
  opensIn: string;
  up: string;
  down: string;
  volume: string;
  resolvedUp: string;
  resolvedDown: string;
  finalResult: string;
  closing: string;
  notStarted: string;
  loadingPrices: string;
  anchor: string;
  average: string;
  price: string;
  chartOpen: string;
  chartNow: string;
  chartClose: string;
  priceToBeat: string;
  startPrice: string;
  currentPrice: string;
  finalPrice: string;
  live: string;
  resolvedTag: string;
  nextTag: string;
  interval: string;
  payoutHeading: string;
  payoutLead: string;
  win: string;
  cta: string;
  terms: string;
  otherMarkets: string;
  upWon: string;
  downWon: string;
};

/**
 * Which timezone a brand renders window times in.
 *
 * PolyBaaz is pinned to Tehran rather than following the browser. Its audience
 * is Iranian, every Farsi user in the database has a Tehran-or-adjacent zone,
 * and a fixed zone means one published schedule that everybody reads the same
 * way — a reader comparing the site against a screenshot or a channel post sees
 * the same clock. Being fixed also lets these labels render on the SERVER, which
 * removes the hydration gap entirely.
 *
 * Oddzy stays on the viewer's own zone: its audience is global, so there is no
 * single correct clock to pin it to.
 */
function zoneFor(locale: "en" | "fa"): string | undefined {
  return locale === "fa" ? "Asia/Tehran" : undefined;
}

/** A position in the selected coin's timeline, live or otherwise. */
type Slot =
  | { kind: "past"; offset: number; row: SettledUpDownWindow }
  | { kind: "live"; offset: 0; row: UpDownWindow }
  | { kind: "future"; offset: number; row: UpDownWindow };

export function UpDownBoard({
  initial,
  initialSettled,
  copy,
  locale,
  tgBot,
}: {
  initial: UpDownWindow[];
  initialSettled: SettledUpDownWindow[];
  copy: UpDownCopy;
  locale: "en" | "fa";
  tgBot: string;
}) {
  const [windows, setWindows] = useState<UpDownWindow[]>(initial);
  const [settled, setSettled] = useState<SettledUpDownWindow[]>(initialSettled);
  const [asset, setAsset] = useState<string | null>(null);
  /** Timeline position relative to the live window. Survives rollover. */
  const [sel, setSel] = useState(0);
  const [amount, setAmount] = useState(AMOUNTS[1]!);
  const [side, setSide] = useState<"up" | "down">("up");

  /**
   * The clock, held in state and null until mount.
   *
   * Two reasons it is not simply `Date.now()` read during render. First, purity:
   * a component that reads the wall clock mid-render produces a different tree
   * on every incidental re-render, which is exactly what the React compiler
   * refuses to memoise. Second, it doubles as the mounted flag — time labels are
   * formatted in the VIEWER's zone, and on the server that zone is UTC, so a
   * server-rendered label said "17:30–17:45" to a reader in Tehran whose clock
   * read 21:05. On a fifteen-minute market that does not read as untidy, it
   * reads as a window from hours ago.
   */
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // Second-resolution, independent of the 5s price poll: a clock that only
    // moved every five seconds would visibly stutter. The first tick lands one
    // second after mount rather than during the effect, which is invisible here
    // because the pre-mount render already shows the API's own seconds_left.
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/updown", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        windows: UpDownWindow[];
        settled: SettledUpDownWindow[];
      };
      setWindows(data.windows ?? []);
      setSettled(data.settled ?? []);
    } catch {
      // Transient. Keep the last good board rather than blanking a live screen.
    }
  }, []);

  useEffect(() => {
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  const assets = useMemo(() => {
    const seen = new Set(windows.map((w) => w.asset));
    for (const r of settled) seen.add(r.asset);
    return [...seen].sort((a, b) => {
      const ia = COIN_ORDER.indexOf(a);
      const ib = COIN_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [windows, settled]);

  const active = asset && assets.includes(asset) ? asset : assets[0] ?? null;

  /**
   * The selected coin's windows arranged in time: resolved ones behind, the
   * running one at zero, scheduled ones ahead.
   */
  const slots = useMemo<Slot[]>(() => {
    if (!active) return [];
    const startOf = (s: string | null) => (s ? new Date(s).getTime() : 0);

    const past = settled
      .filter((r) => r.asset === active && r.window_start)
      .sort((a, b) => startOf(b.window_start) - startOf(a.window_start))
      .slice(0, PAST_SLOTS)
      .reverse();

    /**
     * Live-vs-scheduled is decided by `seconds_left`, which the API computes
     * against ITS clock, rather than by comparing window_start to ours.
     *
     * That matters on the server render, where there is no viewer clock at all,
     * and it matters on a device whose clock is wrong — a phone running a few
     * minutes fast would otherwise classify the running window as already over
     * and show the reader an empty board. seconds_left counts down to close, so
     * anything inside one window length is running and anything beyond it has
     * not opened. It refreshes on every poll, which is far tighter than the
     * fifteen minutes of resolution this decision needs.
     */
    const open = windows
      .filter((w) => w.asset === active && w.window_start && w.window_end)
      .sort((a, b) => startOf(a.window_start) - startOf(b.window_start));

    const liveRow = open.find(
      (w) => w.seconds_left != null && w.seconds_left > 0 && w.seconds_left <= WINDOW_SECONDS,
    );
    const future = open
      .filter((w) => w.seconds_left != null && w.seconds_left > WINDOW_SECONDS)
      .slice(0, FUTURE_SLOTS);

    const out: Slot[] = [];
    past.forEach((row, i) => out.push({ kind: "past", offset: i - past.length, row }));
    if (liveRow) out.push({ kind: "live", offset: 0, row: liveRow });
    future.forEach((row, i) => out.push({ kind: "future", offset: i + 1, row }));
    return out;
  }, [active, windows, settled]);

  // Clamp rather than reset: after a rollover the offset the reader chose may no
  // longer exist, and snapping to the nearest one keeps their place.
  const current = useMemo(() => {
    if (slots.length === 0) return null;
    return (
      slots.find((s) => s.offset === sel) ??
      slots.reduce((best, s) =>
        Math.abs(s.offset - sel) < Math.abs(best.offset - sel) ? s : best,
      )
    );
  }, [slots, sel]);

  /**
   * Hook order is why this sits above the empty-board return rather than beside
   * the chart: `current` can be null on the first paint, and a hook that only
   * ran when it wasn't would change the hook count between renders.
   */
  const series = useWindowPrices(
    current?.row.slug ?? "",
    current?.kind === "live",
    current == null || current.kind === "future",
  );

  if (!active || !current) {
    return <p className="text-[15px] text-[var(--mute)]">{copy.none}</p>;
  }

  const coin = COINS[active] ?? FALLBACK_COIN;
  const tz = zoneFor(locale);
  const showTimes = Boolean(tz) || now != null;
  const fmtTime = (iso: string | null) => {
    if (!iso || !showTimes) return "";
    return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(new Date(iso));
  };

  const resolvedUp = current.kind === "past" ? current.row.won === "up" : null;
  const upPrice = current.kind === "live" ? current.row.up_price : null;
  const downPrice = current.kind === "live" ? current.row.down_price : null;

  // A resolved window has no side to take, so the payout row and the side
  // buttons stop being interactive rather than merely looking inert.
  const settledView = current.kind === "past";
  const effectiveSide = settledView ? (resolvedUp ? "up" : "down") : side;
  const sidePrice = effectiveSide === "up" ? upPrice : downPrice;

  const cents = (p: number | null) => (p == null ? "—" : `${Math.round(p * 100)}¢`);

  return (
    <div className="flex flex-wrap items-start gap-5">
      {/* ── The window under consideration ────────────────────────────────── */}
      <section className="min-w-0 flex-[10_1_540px] rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
        <div className="flex flex-wrap items-center gap-3.5">
          <span
            className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl text-[26px] font-bold text-white"
            style={{ background: coin.color, width: 52, height: 52 }}
            aria-hidden
          >
            {coin.glyph}
          </span>
          <div className="min-w-[140px] flex-1">
            <h2 className="text-[20px] font-bold tracking-[-0.02em]">
              {coin.name || active} · {copy.interval}
              {settledView && ` · ${copy.resolvedTag}`}
              {current.kind === "future" && ` · ${copy.nextTag}`}
            </h2>
            <div className="mt-0.5 text-[13px] text-[var(--faint)]">
              {showTimes && (
                <span className="ltr-num">
                  {fmtTime(current.row.window_start)}–{fmtTime(current.row.window_end)}
                </span>
              )}
              {current.row.volume != null && (
                <>
                  {/* Separator only between two things that both exist — on the
                      pre-mount render the time range is absent, and a dangling
                      "· $283 vol" reads as a missing field. */}
                  {showTimes && " · "}
                  <span className="ltr-num">
                    ${Math.round(current.row.volume).toLocaleString("en-US")}
                  </span>{" "}
                  {copy.volume}
                </>
              )}
            </div>
          </div>
          <Countdown slot={current} copy={copy} now={now} resolvedUp={resolvedUp} />
        </div>

        <PriceRail
          series={series}
          copy={copy}
          coin={coin}
          settledView={settledView}
          hidden={current.kind === "future"}
        />

        <PriceChart
          data={series}
          live={current.kind === "live"}
          pending={current.kind === "future"}
          accent={coin.color}
          decimals={coin.decimals}
          labels={{
            notStarted: copy.notStarted,
            loading: copy.loadingPrices,
            anchor: copy.priceToBeat,
            average: copy.average,
            price: copy.price,
            open: copy.chartOpen,
            now: copy.chartNow,
            close: copy.chartClose,
          }}
        />

        {/* ── Timeline: where this window sits among its neighbours ───────── */}
        <div className="mt-4 flex flex-wrap gap-2">
          {slots.map((s) => {
            const on = s.offset === current.offset;
            const won = s.kind === "past" ? s.row.won === "up" : null;
            return (
              <button
                key={`${s.kind}-${s.offset}`}
                type="button"
                onClick={() => setSel(s.offset)}
                aria-current={on}
                className={[
                  "inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] transition",
                  on ? "ring-2 ring-[var(--accent)]" : "",
                  s.kind === "past"
                    ? "bg-[var(--btn)] font-medium text-[var(--mute)]"
                    : s.kind === "live"
                      ? "bg-[var(--ink)] font-semibold text-[var(--on-ink)]"
                      : "border border-dashed border-[var(--line)] font-medium text-[var(--faint)]",
                ].join(" ")}
              >
                {s.kind !== "future" && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background:
                        s.kind === "live"
                          ? "var(--down)"
                          : won
                            ? "var(--up)"
                            : "var(--down)",
                    }}
                    aria-hidden
                  />
                )}
                {/* Until the viewer's zone is known these labels cannot be
                    formatted (see zoneFor), and an empty pill reads as a broken
                    control rather than a pending one. A same-width placeholder
                    holds the row's shape so nothing jumps on hydration. */}
                <span className="ltr-num tabular-nums">
                  {showTimes ? fmtTime(s.row.window_start) : "··:··"}
                </span>
                {s.kind === "live" && <span>— {copy.live}</span>}
              </button>
            );
          })}
        </div>

        {/* ── The two sides ───────────────────────────────────────────────── */}
        <div className="mt-4 flex gap-3">
          <SideButton
            label={copy.up}
            price={cents(upPrice)}
            tone="var(--up)"
            active={effectiveSide === "up"}
            disabled={settledView || current.kind === "future"}
            onClick={() => setSide("up")}
          />
          <SideButton
            label={copy.down}
            price={cents(downPrice)}
            tone="var(--down)"
            active={effectiveSide === "down"}
            disabled={settledView || current.kind === "future"}
            onClick={() => setSide("down")}
          />
        </div>
      </section>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className="flex min-w-[280px] flex-[1_1_300px] flex-col gap-5">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[16px] font-bold">{copy.payoutHeading}</h3>
            <span
              className="rounded-full px-3 py-1 text-[12.5px] font-bold"
              style={{
                background: effectiveSide === "up" ? "var(--up)" : "var(--down)",
                color: "var(--card)",
              }}
            >
              {settledView
                ? resolvedUp
                  ? copy.upWon
                  : copy.downWon
                : `${effectiveSide === "up" ? copy.up : copy.down} ${cents(sidePrice)}`}
            </span>
          </div>

          <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--faint)]">
            {copy.payoutLead}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {AMOUNTS.map((v) => {
              const on = v === amount && !settledView;
              // Payout is stake ÷ price: a share pays $1 if it wins, so $5 at
              // 62¢ buys 8.06 shares. Null price means we cannot claim a number.
              const win =
                sidePrice && sidePrice > 0
                  ? `$${(v / sidePrice).toFixed(2)}`
                  : "—";
              return (
                <button
                  key={v}
                  type="button"
                  disabled={settledView}
                  aria-pressed={on}
                  onClick={() => setAmount(v)}
                  className={[
                    "flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2.5 transition",
                    on
                      ? "border-[var(--accent)] bg-[var(--btn)]"
                      : "border-[var(--line)] bg-[var(--paper)]",
                    settledView ? "opacity-55" : "",
                  ].join(" ")}
                >
                  <span className="ltr-num text-[17px] font-bold">${v}</span>
                  <span className="ltr-num text-[11.5px] text-[var(--faint)]">
                    {copy.win} {win}
                  </span>
                </button>
              );
            })}
          </div>

          <a
            href={`https://t.me/${tgBot}`}
            className="mt-4 block rounded-xl bg-[var(--accent)] px-5 py-3 text-center text-[15px] font-semibold text-[var(--on-accent)]"
          >
            {copy.cta}
          </a>
          <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--faint)]">
            {copy.terms}
          </p>
        </section>

        {assets.length > 1 && (
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-2">
            <h3 className="px-3 pt-2 pb-1.5 text-[13px] font-semibold text-[var(--mute)]">
              {copy.otherMarkets}
            </h3>
            <div className="flex flex-col">
              {assets
                .filter((a) => a !== active)
                .map((a) => {
                  const c = COINS[a] ?? FALLBACK_COIN;
                  const w = windows.find(
                    (x) => x.asset === a && x.up_price != null,
                  );
                  const pu = w?.up_price ?? null;
                  const isUp = pu != null && pu >= 0.5;
                  const pct =
                    pu == null
                      ? "—"
                      : `${Math.round((isUp ? pu : 1 - pu) * 100)}% ${isUp ? copy.up : copy.down}`;
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => {
                        setAsset(a);
                        setSel(0);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition hover:bg-[var(--btn)]"
                    >
                      <span
                        className="grid h-9.5 w-9.5 shrink-0 place-items-center rounded-xl text-[18px] font-bold text-white"
                        style={{ background: c.color, width: 38, height: 38 }}
                        aria-hidden
                      >
                        {c.glyph}
                      </span>
                      <span className="flex-1">
                        <span className="block text-[14.5px] font-semibold">
                          {c.name || a}
                        </span>
                        <span className="block text-[12px] text-[var(--faint)]">
                          {a} · {copy.interval}
                        </span>
                      </span>
                      <span
                        className="ltr-num whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-bold"
                        style={{
                          color: pu == null ? "var(--faint)" : isUp ? "var(--up)" : "var(--down)",
                          background: "var(--paper)",
                        }}
                      >
                        {pct}
                      </span>
                    </button>
                  );
                })}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}

/**
 * The countdown, or the verdict.
 *
 * A resolved window shows its result in the same slot the clock occupied, so the
 * eye does not have to go looking for the answer to the question the rest of the
 * card just posed.
 */
function Countdown({
  slot,
  copy,
  now,
  resolvedUp,
}: {
  slot: Slot;
  copy: UpDownCopy;
  /** Wall clock, null until mount. */
  now: number | null;
  resolvedUp: boolean | null;
}) {
  if (slot.kind === "past") {
    return (
      <div className="text-center">
        <div
          className="text-[24px] font-bold"
          style={{ color: resolvedUp ? "var(--up)" : "var(--down)" }}
        >
          {resolvedUp ? copy.resolvedUp : copy.resolvedDown}
        </div>
        <div className="text-[12px] text-[var(--faint)]">{copy.finalResult}</div>
      </div>
    );
  }

  /**
   * Before mount there is no local clock, so the countdown falls back to the
   * API's own `seconds_left` — which is a real number, not a placeholder. That
   * is the difference between a first paint showing "12:04" and one showing a
   * dash that snaps to a time a moment later, on the single element the reader
   * came to this page to look at.
   */
  const secondsLeft = slot.row.seconds_left;
  const target = slot.kind === "future" ? slot.row.window_start : slot.row.window_end;
  const ms = target ? new Date(target).getTime() : null;

  let left: number | null;
  if (now != null && ms != null) {
    left = Math.max(0, Math.floor((ms - now) / 1000));
  } else if (secondsLeft != null) {
    // seconds_left counts to CLOSE; a scheduled window opens one length earlier.
    left = Math.max(0, slot.kind === "future" ? secondsLeft - WINDOW_SECONDS : secondsLeft);
  } else {
    left = null;
  }

  const closing = slot.kind === "live" && left != null && left < 120;

  return (
    <div className="text-center">
      <div
        className="ltr-num text-[32px] font-bold tabular-nums"
        style={{
          color:
            slot.kind === "future"
              ? "var(--accent)"
              : closing
                ? "var(--down)"
                : "var(--ink)",
        }}
      >
        {left == null
          ? "—"
          : `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`}
      </div>
      <div className="text-[12px] text-[var(--faint)]">
        {slot.kind === "future" ? copy.opensIn : closing ? copy.closing : copy.closesIn}
      </div>
    </div>
  );
}

/**
 * The two figures the chart is about: what the average has to beat, and where
 * the average stands now.
 *
 * The headline number is the AVERAGE, not spot. Polymarket's own up/down page
 * puts spot here because spot is what settles their 5m markets; ours settle on
 * the average, so putting spot in the same slot would make the biggest number on
 * the page the one that does not decide the outcome. Spot is still shown, small,
 * to its right — a reader watching the coin tick wants to see it, they just must
 * not mistake it for the verdict.
 */
function PriceRail({
  series,
  copy,
  coin,
  settledView,
  hidden,
}: {
  series: PriceSeries | null;
  copy: UpDownCopy;
  coin: Coin;
  settledView: boolean;
  hidden: boolean;
}) {
  if (hidden) return null;

  const pts = series?.points ?? [];
  const last = pts[pts.length - 1] ?? null;
  const anchor = series?.anchor ?? null;
  const fmt = (v: number) =>
    `$${v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v.toFixed(coin.decimals)}`;

  // Against the anchor, because that IS the resolution comparison. A delta
  // measured off spot would be a different question than the one being asked.
  const delta = last && anchor != null ? last.twap - anchor : null;
  const winning = delta != null && delta >= 0;
  const tone = winning ? "var(--up)" : "var(--down)";

  return (
    <div className="mt-5 flex flex-wrap gap-x-9 gap-y-4">
      <div>
        <div className="text-[12px] text-[var(--faint)]">
          {settledView ? copy.startPrice : copy.priceToBeat}
        </div>
        <div className="ltr-num text-[24px] font-bold tabular-nums">
          {anchor == null ? "—" : fmt(anchor)}
        </div>
      </div>
      <div>
        <div className="text-[12px] text-[var(--faint)]">
          {settledView ? copy.finalPrice : copy.currentPrice}
        </div>
        <div className="flex items-baseline gap-2.5">
          <span
            className="ltr-num text-[24px] font-bold tabular-nums"
            style={{ color: delta == null ? "var(--ink)" : tone }}
          >
            {last == null ? "—" : fmt(last.twap)}
          </span>
          {delta != null && (
            <span className="ltr-num text-[14px] font-semibold" style={{ color: tone }}>
              {winning ? "▲" : "▼"} {fmt(Math.abs(delta))}
            </span>
          )}
        </div>
        {last != null && (
          <div className="mt-0.5 text-[11.5px] text-[var(--faint)]">
            {copy.price} <span className="ltr-num">{fmt(last.p)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SideButton({
  label,
  price,
  tone,
  active,
  disabled,
  onClick,
}: {
  label: string;
  price: string;
  tone: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className="flex flex-1 items-center justify-center gap-2.5 rounded-xl border-[1.5px] px-2.5 py-3.5 text-[17px] font-bold transition"
      style={{
        borderColor: active ? tone : "var(--line)",
        background: active ? tone : "var(--paper)",
        color: active ? "var(--card)" : tone,
        opacity: disabled && !active ? 0.55 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {label} <span className="ltr-num tabular-nums">{price}</span>
    </button>
  );
}
