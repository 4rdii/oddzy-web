"use client";

import { useState } from "react";
import type { Market } from "@/lib/api";
import { cents, compactUsd, pct, payoutFor, shortDate, usd } from "@/lib/format";

const STAKE_CHIPS = [10, 25, 50, 100];

export type PlacedBet = {
  market: Market;
  side: "YES" | "NO";
  stake: number;
  price: number;
  shares: number;
  payout: number;
  txHash: string | null;
  orderId: string | null;
};

/**
 * Market detail + bet slip.
 *
 * The slip is a bottom sheet, per the prototype: pick side → stake → live
 * payout preview → confirm. Placement goes through /api/bet, which fronts the
 * bot's order-signing path; until that endpoint ships it answers 501 and we
 * surface that plainly rather than faking a receipt.
 */
export function MarketDetail({
  market,
  onBack,
  onPlaced,
  balance,
}: {
  market: Market;
  onBack: () => void;
  onPlaced: (bet: PlacedBet) => void;
  balance: number | null;
}) {
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [stake, setStake] = useState(25);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = side === "YES" ? market.probability.yes : market.probability.no;
  const shares = price > 0 ? stake / price : 0;
  const payout = payoutFor(stake, price);
  const yesPct = pct(market.probability.yes);

  const insufficient = balance != null && stake > balance;

  async function place() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: market.id,
          slug: market.slug,
          side,
          sizeUsdc: stake,
          quotedPrice: price,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Couldn't place that bet.");
        return;
      }

      onPlaced({
        market,
        side,
        stake,
        price: data.avgPrice ?? price,
        shares: data.filledShares ?? shares,
        payout: payoutFor(stake, data.avgPrice ?? price),
        txHash: data.txHash ?? null,
        orderId: data.orderId ?? null,
      });
    } catch {
      setError("Network error — your bet was not placed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-28">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[40px] rounded-lg px-2 font-mono text-[12px] text-[var(--mute)]"
        >
          ← Back
        </button>
      </div>

      <div className="px-4">
        <h1 className="text-[19px] leading-snug font-bold tracking-[-0.02em]">
          {market.title}
        </h1>

        {/* Probability ring */}
        <div className="mt-5 flex items-center gap-5">
          <ProbabilityRing value={yesPct} />
          <div className="flex flex-col gap-2">
            <Stat label="VOLUME" value={compactUsd(market.volume.total)} />
            <Stat label="24H" value={compactUsd(market.volume.h24)} />
            <Stat label="RESOLVES" value={shortDate(market.close_time)} />
          </div>
        </div>

        {market.category && (
          <p className="mt-4 font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
            {market.category.name.toUpperCase()}
          </p>
        )}

        <section className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
          <h2 className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
            RESOLUTION
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--text2)]">
            Settles on-chain via Polymarket at close. Final outcome is determined by the
            market&apos;s oracle; where an outcome is disputed, the UMA optimistic oracle
            decides.
          </p>
          <a
            href={market.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block font-mono text-[11px] text-[var(--accent)]"
          >
            View on Polymarket ↗
          </a>
        </section>

        <p className="mt-4 text-[11px] leading-relaxed text-[var(--faint)]">
          Prediction markets carry risk of loss. 18+. Oddzy is an interface to Polymarket
          — it never holds your funds.
        </p>
      </div>

      {/* Sticky side picker */}
      <div className="fixed inset-x-0 bottom-[64px] z-30 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--page)_92%,transparent)] p-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-md gap-2">
          <SideButton
            side="YES"
            active={side === "YES"}
            price={market.probability.yes}
            onClick={() => {
              setSide("YES");
              setSheetOpen(true);
            }}
          />
          <SideButton
            side="NO"
            active={side === "NO"}
            price={market.probability.no}
            onClick={() => {
              setSide("NO");
              setSheetOpen(true);
            }}
          />
        </div>
      </div>

      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setSheetOpen(false)}
            aria-hidden
          />
          <div
            className="oz-sheet fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-[var(--line)] bg-[var(--paper)] p-5 pb-8"
            role="dialog"
            aria-modal="true"
            aria-label="Place bet"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--handle)]" />

            <div className="mx-auto max-w-md">
              <div className="flex gap-2">
                <SideButton
                  side="YES"
                  active={side === "YES"}
                  price={market.probability.yes}
                  onClick={() => setSide("YES")}
                />
                <SideButton
                  side="NO"
                  active={side === "NO"}
                  price={market.probability.no}
                  onClick={() => setSide("NO")}
                />
              </div>

              <div className="mt-5 flex items-baseline justify-between">
                <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
                  STAKE
                </span>
                <span className="font-mono text-[26px] font-semibold">{usd(stake)}</span>
              </div>

              <div className="mt-3 flex gap-2">
                {STAKE_CHIPS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setStake(v)}
                    className={`min-h-[44px] flex-1 rounded-xl font-mono text-[14px] font-semibold transition-colors ${
                      stake === v
                        ? "bg-[var(--ink)] text-[var(--on-ink)]"
                        : "border border-[var(--line)] bg-[var(--btn)] text-[var(--mute)]"
                    }`}
                  >
                    ${v}
                  </button>
                ))}
              </div>

              <label className="mt-3 block">
                <span className="sr-only">Custom stake in dollars</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={stake}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setStake(Number.isFinite(n) && n > 0 ? n : 1);
                  }}
                  className="min-h-[44px] w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 font-mono text-[15px] text-[var(--ink)]"
                  placeholder="Custom amount"
                />
              </label>

              <div className="mt-4 flex items-center justify-between rounded-xl bg-[var(--btn)] px-4 py-3">
                <span className="text-[13px] text-[var(--mute)]">Payout if correct</span>
                <span className="font-mono text-[17px] font-bold text-[var(--up)]">
                  {usd(payout)}
                </span>
              </div>

              <p className="mt-2 flex justify-between font-mono text-[11px] text-[var(--faint)]">
                <span>{shares.toFixed(1)} shares @ {cents(price)}</span>
                {balance != null && <span>Balance {usd(balance)}</span>}
              </p>

              {insufficient && (
                <p className="mt-3 text-[13px] text-[var(--down)]">
                  Stake is more than your available balance.
                </p>
              )}

              {error && (
                <p className="mt-3 rounded-lg bg-[color-mix(in_srgb,var(--down)_12%,transparent)] px-3 py-2 text-[13px] text-[var(--down)]">
                  {error}
                </p>
              )}

              <button
                type="button"
                disabled={submitting || insufficient}
                onClick={place}
                className="mt-4 min-h-[52px] w-full rounded-2xl bg-[var(--ink)] text-[16px] font-bold text-[var(--on-ink)] disabled:opacity-50"
              >
                {submitting ? "Placing…" : `Place ${side} bet · ${usd(stake)}`}
              </button>

              <p className="mt-3 text-center font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
                SIGNED ON-CHAIN · NON-REVERSIBLE
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SideButton({
  side,
  active,
  price,
  onClick,
}: {
  side: "YES" | "NO";
  active: boolean;
  price: number;
  onClick: () => void;
}) {
  const color = side === "YES" ? "var(--up)" : "var(--down)";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="min-h-[50px] flex-1 rounded-xl border text-[15px] font-semibold transition-colors"
      style={{
        background: active ? `color-mix(in srgb, ${color} 13%, transparent)` : "var(--btn)",
        color: active ? color : "var(--mute)",
        borderColor: active ? color : "var(--line)",
      }}
    >
      {side} · {cents(price)}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] tracking-[0.08em] text-[var(--faint)]">
        {label}
      </div>
      <div className="font-mono text-[14px] font-semibold">{value}</div>
    </div>
  );
}

function ProbabilityRing({ value }: { value: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const filled = (value / 100) * c;
  return (
    <div className="relative h-[104px] w-[104px] shrink-0">
      <svg viewBox="0 0 104 104" className="h-full w-full -rotate-90">
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--bar)" strokeWidth="9" />
        <circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          stroke="var(--up)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[22px] font-bold">{value}%</span>
        <span className="font-mono text-[9px] tracking-[0.08em] text-[var(--faint)]">
          YES
        </span>
      </div>
    </div>
  );
}
