"use client";

import { useState } from "react";
import { usd } from "@/lib/format";
import { authedPost, ApiCallError } from "@/lib/client-api";

/** Round down to whole cents, mirroring the server so Max never over-asks. */
const round2 = (n: number) => Math.floor(n * 100) / 100;

const PERCENTS = [25, 50, 100] as const;

export type WithdrawSent = { txHash: string | null; amountUsdc: number; toAddress: string };

/**
 * Withdraw sheet.
 *
 * Mirrors the bot's flow — address, amount, confirm — and posts to
 * /webapp/v1/withdraw, which runs the same withdrawCore the chat flow calls.
 *
 * Everything validated here is validated again server-side, inside the lock:
 * the address, the amount, and above all the balance, which is re-read at send
 * time rather than trusted from this screen. Treat these checks as courtesy to
 * the user, not as a control.
 */
export function WithdrawSheet({
  balance,
  onClose,
  onSent,
}: {
  balance: number;
  onClose: () => void;
  onSent: (sent: WithdrawSent) => void;
}) {
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(amount);
  const amountValid = Number.isFinite(parsed) && parsed > 0 && round2(parsed) <= balance;
  // Deliberately loose — the server is the authority on address validity. This
  // only catches the obvious typo before costing a round trip.
  const addressValid = /^0x[a-fA-F0-9]{40}$/.test(address.trim());

  async function send() {
    setSubmitting(true);
    setError(null);
    try {
      const data = await authedPost<WithdrawSent>("/webapp/v1/withdraw", {
        toAddress: address.trim(),
        amountUsdc: round2(parsed),
      });
      onSent(data);
    } catch (e) {
      const server = (e as ApiCallError & { serverMessage?: string })?.serverMessage;
      setError(server ?? "The withdrawal failed. Nothing was sent.");
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <div
        className="oz-sheet fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-[var(--line)] bg-[var(--paper)] p-5 pb-8"
        role="dialog"
        aria-modal="true"
        aria-label="Withdraw"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--handle)]" />

        <div className="mx-auto max-w-md">
          {!confirming ? (
            <>
              <h2 className="text-[18px] font-bold tracking-[-0.02em]">Withdraw</h2>
              <p className="mt-1 text-[12px] text-[var(--mute)]">
                Available {usd(balance)} · USDC on Polygon
              </p>

              <label className="mt-4 block">
                <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
                  TO ADDRESS
                </span>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="0x…"
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1 min-h-[46px] w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 font-mono text-[13px] text-[var(--ink)]"
                />
              </label>

              <label className="mt-3 block">
                <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
                  AMOUNT (USDC)
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 min-h-[46px] w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 font-mono text-[15px] text-[var(--ink)]"
                />
              </label>

              <div className="mt-3 flex gap-2">
                {PERCENTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(String(round2((balance * p) / 100)))}
                    className="min-h-[40px] flex-1 rounded-xl border border-[var(--line)] bg-[var(--btn)] font-mono text-[13px] font-semibold text-[var(--mute)]"
                  >
                    {p === 100 ? "MAX" : `${p}%`}
                  </button>
                ))}
              </div>

              {amount !== "" && !amountValid && (
                <p className="mt-3 text-[13px] text-[var(--down)]">
                  {parsed > balance
                    ? "That's more than your available balance."
                    : "Enter an amount greater than zero."}
                </p>
              )}

              <button
                type="button"
                disabled={!addressValid || !amountValid}
                onClick={() => setConfirming(true)}
                className="mt-4 min-h-[52px] w-full rounded-2xl bg-[var(--ink)] text-[16px] font-bold text-[var(--on-ink)] disabled:opacity-50"
              >
                Review
              </button>
            </>
          ) : (
            <>
              <h2 className="text-[18px] font-bold tracking-[-0.02em]">Confirm withdrawal</h2>

              <div className="mt-4 rounded-xl bg-[var(--btn)] p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-[var(--mute)]">Amount</span>
                  <span className="font-mono text-[20px] font-bold">{usd(round2(parsed))}</span>
                </div>
                <div className="mt-3">
                  <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
                    TO
                  </span>
                  <code className="mt-1 block font-mono text-[12px] break-all">
                    {address.trim()}
                  </code>
                </div>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-[var(--faint)]">
                Sends on Polygon. On-chain transfers cannot be reversed — check the address.
              </p>

              {error && (
                <p className="mt-3 rounded-lg bg-[color-mix(in_srgb,var(--down)_12%,transparent)] px-3 py-2 text-[13px] text-[var(--down)]">
                  {error}
                </p>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={send}
                className="mt-4 min-h-[52px] w-full rounded-2xl bg-[var(--ink)] text-[16px] font-bold text-[var(--on-ink)] disabled:opacity-50"
              >
                {submitting ? "Sending…" : `Send ${usd(round2(parsed))}`}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirming(false)}
                className="mt-2 min-h-[40px] w-full text-[13px] text-[var(--mute)]"
              >
                Back
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
