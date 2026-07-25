"use client";

import type { PlacedBet } from "./MarketDetail";
import { cents, shortDate, usd } from "@/lib/format";

/**
 * Confirmation — ticket-style receipt.
 * The on-chain reference is the point of this screen (the prototype's "real
 * proof" pattern), so when we have no tx hash yet we say so rather than
 * rendering an empty row that looks like a missing value.
 */
export function Receipt({
  bet,
  onPositions,
  onNext,
}: {
  bet: PlacedBet;
  onPositions: () => void;
  onNext: () => void;
}) {
  const sideColor = bet.side === "YES" ? "var(--up)" : "var(--down)";

  return (
    <div className="oz-pop px-4 py-8 pb-28">
      <div className="mx-auto max-w-md">
        <div className="flex flex-col items-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-[26px]"
            style={{ background: "color-mix(in srgb, var(--up) 15%, transparent)", color: "var(--up)" }}
            aria-hidden
          >
            ✓
          </div>
          <h1 className="mt-4 text-[20px] font-bold tracking-[-0.02em]">Bet placed</h1>
          <p className="mt-1 text-[13px] text-[var(--mute)]">Receipt settled to chain</p>
        </div>

        <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
          <div className="font-mono text-[10px] tracking-[0.08em] text-[var(--faint)]">
            ODDZY RECEIPT
          </div>
          <h2 className="mt-2 text-[15px] leading-snug font-semibold">{bet.market.title}</h2>

          <dl className="mt-4 flex flex-col gap-2.5">
            <Row label="Side">
              <span className="font-bold" style={{ color: sideColor }}>
                {bet.side}
              </span>
            </Row>
            <Row label="Stake">{usd(bet.stake)}</Row>
            <Row label="Price">{cents(bet.price)}</Row>
            <Row label="Shares">{bet.shares.toFixed(1)}</Row>
            <Row label="Payout if correct">
              <span className="font-bold text-[var(--up)]">{usd(bet.payout)}</span>
            </Row>
            <Row label="Resolves">{shortDate(bet.market.close_time)}</Row>
          </dl>

          <div className="mt-4 border-t border-dashed border-[var(--line)] pt-4">
            <div className="font-mono text-[9px] tracking-[0.08em] text-[var(--faint)]">
              TX HASH
            </div>
            {bet.txHash ? (
              <a
                href={`https://polygonscan.com/tx/${bet.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block font-mono text-[12px] break-all text-[var(--accent)]"
              >
                {bet.txHash}
              </a>
            ) : (
              <p className="mt-1 font-mono text-[12px] text-[var(--mute)]">
                Confirming on-chain — appears in Positions shortly.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onPositions}
            className="min-h-[50px] flex-1 rounded-2xl bg-[var(--ink)] font-semibold text-[var(--on-ink)]"
          >
            View position
          </button>
          <button
            type="button"
            onClick={onNext}
            className="min-h-[50px] flex-1 rounded-2xl border border-[var(--line)] bg-[var(--btn)] font-semibold text-[var(--mute)]"
          >
            Next market
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[13px] text-[var(--mute)]">{label}</dt>
      <dd className="font-mono text-[14px]">{children}</dd>
    </div>
  );
}
