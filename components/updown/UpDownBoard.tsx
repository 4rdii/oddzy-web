"use client";

import { useEffect, useMemo, useState } from "react";
import type { UpDownWindow, SettledUpDownWindow } from "@/lib/api";
import { PriceChart, useWindowPrices } from "./PriceChart";
import {
  Countdown,
  CoinBadge,
  OtherCoins,
  PriceRail,
  SideButtons,
  Timeline,
  makeTimeFormatter,
  useDeskModel,
  zoneFor,
} from "./desk";

/**
 * The public Up/Down desk: one focused market, its neighbours in time along the
 * bottom, its sibling coins down the side.
 *
 * Client-rendered and polled, which is unusual for this site — every other page
 * is a static server render because it exists for crawlers. This one is the
 * opposite: it is a live instrument, and a window is stale before a server
 * render reaches the browser.
 *
 * The desk itself lives in ./desk and is shared with the mini-app's trading tab.
 * The only thing this file adds is the action slot: a payout calculator and the
 * standard Telegram CTA, because positions open in the bot and the app and a
 * live-looking buy that silently did nothing would be worse than none.
 */

const POLL_MS = 5000;

/** Stake sizes in the payout row. Matches the sizes the bot offers. */
const AMOUNTS = [5, 25, 100];

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
  chartOpen: string;
  chartNow: string;
  chartClose: string;
  priceToBeat: string;
  currentPrice: string;
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
  const [amount, setAmount] = useState(AMOUNTS[1]!);
  const [side, setSide] = useState<"up" | "down">("up");

  /**
   * The clock, held in state and null until mount. Not read during render —
   * a component that reads the wall clock mid-render produces a different tree
   * on every incidental re-render. It doubles as the mounted flag, because time
   * labels are formatted in the VIEWER's zone and on the server that zone is
   * UTC: a server-rendered label said "17:30–17:45" to a reader in Tehran whose
   * clock read 21:05, which on a fifteen-minute market reads as a window from
   * hours ago rather than as untidy.
   */
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const tick = () => {
      fetch("/api/updown", { cache: "no-store", signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { windows?: UpDownWindow[]; settled?: SettledUpDownWindow[] } | null) => {
          if (!d) return;
          setWindows(d.windows ?? []);
          setSettled(d.settled ?? []);
        })
        .catch(() => {
          // Transient. Keep the last good board rather than blanking a live screen.
        });
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      clearInterval(id);
      ctrl.abort();
    };
  }, []);

  const { assets, active, setAsset, setSel, slots, current, secondsLeft, coin } =
    useDeskModel({ windows, settled, now });

  const series = useWindowPrices(
    current?.row.slug ?? "",
    current?.kind === "live",
    current == null || current.kind === "future",
  );

  const tz = zoneFor(locale);
  const showTimes = Boolean(tz) || now != null;
  const fmtTime = useMemo(() => {
    const f = makeTimeFormatter(locale);
    return (iso: string | null) => (iso && showTimes ? f.format(new Date(iso)) : "");
  }, [locale, showTimes]);

  if (!active || !current) {
    return <p className="text-[15px] text-[var(--mute)]">{copy.none}</p>;
  }

  const settledView = current.kind === "past";
  const resolvedUp = settledView ? current.row.won === "up" : null;
  const upPrice = current.kind === "live" ? current.row.up_price : null;
  const downPrice = current.kind === "live" ? current.row.down_price : null;
  const effectiveSide = settledView ? (resolvedUp ? "up" : "down") : side;
  const sidePrice = effectiveSide === "up" ? upPrice : downPrice;
  const cents = (p: number | null) => (p == null ? "—" : `${Math.round(p * 100)}¢`);

  return (
    <div className="flex flex-wrap items-start gap-5">
      <section className="min-w-0 flex-[10_1_540px] rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
        <div className="flex flex-wrap items-center gap-3.5">
          <CoinBadge coin={coin} size={52} />
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
                  {showTimes && " · "}
                  <span className="ltr-num">
                    ${Math.round(current.row.volume).toLocaleString("en-US")}
                  </span>{" "}
                  {copy.volume}
                </>
              )}
            </div>
          </div>
          <Countdown
            slot={current}
            seconds={secondsLeft}
            labels={{
              closesIn: copy.closesIn,
              opensIn: copy.opensIn,
              closing: copy.closing,
              finalResult: copy.finalResult,
              resolvedUp: copy.resolvedUp,
              resolvedDown: copy.resolvedDown,
            }}
          />
        </div>

        {current.kind !== "future" && (
          <PriceRail
            series={series}
            coin={coin}
            labels={{
              priceToBeat: copy.priceToBeat,
              current: copy.currentPrice,
              average: copy.average,
            }}
          />
        )}

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
            open: copy.chartOpen,
            now: copy.chartNow,
            close: copy.chartClose,
          }}
        />

        <Timeline
          slots={slots}
          current={current}
          onSelect={setSel}
          showTimes={showTimes}
          fmtTime={fmtTime}
          liveLabel={copy.live}
        />

        <SideButtons
          upPrice={upPrice}
          downPrice={downPrice}
          activeSide={effectiveSide}
          disabled={settledView || current.kind === "future"}
          onPick={setSide}
          labels={{ up: copy.up, down: copy.down }}
        />
      </section>

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

          <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--faint)]">{copy.payoutLead}</p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {AMOUNTS.map((v) => {
              const on = v === amount && !settledView;
              // Payout is stake ÷ price: a share pays $1 if it wins, so $5 at
              // 62¢ buys 8.06 shares. Null price means we cannot claim a number.
              const win = sidePrice && sidePrice > 0 ? `$${(v / sidePrice).toFixed(2)}` : "—";
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
          <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--faint)]">{copy.terms}</p>
        </section>

        <OtherCoins
          assets={assets}
          active={active}
          windows={windows}
          onSelect={(a) => {
            setAsset(a);
            setSel(0);
          }}
          labels={{
            heading: copy.otherMarkets,
            up: copy.up,
            down: copy.down,
            interval: copy.interval,
          }}
        />
      </aside>
    </div>
  );
}
