"use client";

import { useEffect, useState } from "react";
import { usd } from "@/lib/format";
import { authedGet, authedPost, ApiCallError } from "@/lib/client-api";
import { useLocale } from "./LocaleProvider";

/** Round down to whole cents, mirroring the server so Max never over-asks. */
const round2 = (n: number) => Math.floor(n * 100) / 100;

const PERCENTS = [25, 50, 100] as const;

/**
 * Where a withdrawal can go. Mirrors @sb/vault's SUPPORTED_DEST_CHAINS and the
 * bot's picker; the labels are presentation, and the SERVER re-validates the
 * chain on every send — a chain id from this list is still user input by the
 * time it reaches withdrawCore.
 *
 * Polygon is first and default: it settles in one transaction, costs nothing
 * extra, and is the only option that is done the moment the receipt appears.
 */
const DEST_CHAINS = [
  { id: 137, label: "Polygon" },
  { id: 8453, label: "Base" },
  { id: 42161, label: "Arbitrum" },
  { id: 56, label: "BNB Chain" },
] as const;
const POLYGON_ID = 137;

export type WithdrawSent = {
  txHash: string | null;
  amountUsdc: number;
  toAddress: string;
  /** 137 = done on confirm; anything else is still bridging when this returns. */
  destChainId?: number;
};

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
  const { t, tf } = useLocale();
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destChainId, setDestChainId] = useState<number>(POLYGON_ID);
  /**
   * The quoted net for a bridged withdrawal. `undefined` = not asked yet,
   * `null` = asked and unpriceable (say so rather than show a stale figure).
   */
  const [quote, setQuote] = useState<{ out: string; symbol: string } | null | undefined>(undefined);
  const [quoting, setQuoting] = useState(false);

  const parsed = Number(amount);
  const amountValid = Number.isFinite(parsed) && parsed > 0 && round2(parsed) <= balance;
  // Deliberately loose — the server is the authority on address validity. This
  // only catches the obvious typo before costing a round trip.
  const addressValid = /^0x[a-fA-F0-9]{40}$/.test(address.trim());

  /**
   * Re-price whenever the destination or amount changes. Polygon needs no quote
   * (nothing is bridged). Debounced, because the amount field fires per
   * keystroke and each quote is a round trip to Relay.
   */
  useEffect(() => {
    if (destChainId === POLYGON_ID || !amountValid) {
      setQuote(undefined);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    const id = setTimeout(() => {
      const qs = new URLSearchParams({
        amount: String(round2(parsed)),
        destChainId: String(destChainId),
        toAddress: address.trim(),
      });
      authedGet<{ quote: { out: string; symbol: string } | null }>(
        `/webapp/v1/withdraw-quote?${qs}`,
      )
        .then((d) => {
          if (!cancelled) setQuote(d.quote ?? null);
        })
        .catch(() => {
          if (!cancelled) setQuote(null);
        })
        .finally(() => {
          if (!cancelled) setQuoting(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [destChainId, parsed, amountValid, address]);

  async function send() {
    setSubmitting(true);
    setError(null);
    try {
      const data = await authedPost<WithdrawSent>("/webapp/v1/withdraw", {
        toAddress: address.trim(),
        amountUsdc: round2(parsed),
        destChainId,
      });
      onSent(data);
    } catch (e) {
      const server = (e as ApiCallError & { serverMessage?: string })?.serverMessage;
      setError(server ?? t.app.withdraw.failed);
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
        aria-label={t.app.withdraw.sheetLabel}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--handle)]" />

        <div className="mx-auto max-w-md">
          {!confirming ? (
            <>
              <h2 className="text-[18px] font-bold tracking-[-0.02em]">{t.app.withdraw.title}</h2>
              <p className="mt-1 text-[12px] text-[var(--mute)]">
                {t.app.withdraw.available} <span className="ltr-num">{usd(balance)}</span>{" "}
                {t.app.withdraw.onPolygon}
              </p>

              <label className="mt-4 block">
                <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
                  {t.app.withdraw.toAddress}
                </span>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t.app.withdraw.addressPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1 min-h-[46px] w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 font-mono text-[13px] text-[var(--ink)]"
                />
              </label>

              <label className="mt-3 block">
                <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
                  {t.app.withdraw.amountLabel}
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={t.app.withdraw.amountPlaceholder}
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
                    {p === 100 ? t.app.withdraw.max : tf(t.app.withdraw.pctChip, { p })}
                  </button>
                ))}
              </div>

              {/* Destination. Polygon is one transaction and free; the others
                  bridge, cost a little, and arrive a minute later — so the net
                  is quoted below rather than left as a surprise. */}
              <div className="mt-4">
                <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
                  {t.app.withdraw.destination}
                </span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {DEST_CHAINS.map((c) => {
                    const on = c.id === destChainId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setDestChainId(c.id)}
                        aria-pressed={on}
                        className="rounded-xl border px-3 py-1.5 text-[12px] font-semibold"
                        style={{
                          borderColor: on ? "var(--accent)" : "var(--line)",
                          color: on ? "var(--accent)" : "var(--text2)",
                        }}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
                {destChainId !== POLYGON_ID && (
                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--mute)]">
                    {quoting
                      ? t.app.withdraw.quoting
                      : quote
                        ? t.app.withdraw.quoteLine
                            .replace("{out}", quote.out)
                            .replace("{symbol}", quote.symbol)
                        : quote === null
                          ? t.app.withdraw.quoteFailed
                          : t.app.withdraw.bridgeNote}
                  </p>
                )}
              </div>

              {amount !== "" && !amountValid && (
                <p className="mt-3 text-[13px] text-[var(--down)]">
                  {parsed > balance ? t.app.withdraw.tooMuch : t.app.withdraw.positive}
                </p>
              )}

              <button
                type="button"
                disabled={!addressValid || !amountValid}
                onClick={() => setConfirming(true)}
                className="mt-4 min-h-[52px] w-full rounded-2xl bg-[var(--ink)] text-[16px] font-bold text-[var(--on-ink)] disabled:opacity-50"
              >
                {t.app.withdraw.review}
              </button>
            </>
          ) : (
            <>
              <h2 className="text-[18px] font-bold tracking-[-0.02em]">
                {t.app.withdraw.confirmTitle}
              </h2>

              <div className="mt-4 rounded-xl bg-[var(--btn)] p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-[var(--mute)]">{t.app.withdraw.amount}</span>
                  <span className="ltr-num font-mono text-[20px] font-bold">
                    {usd(round2(parsed))}
                  </span>
                </div>
                <div className="mt-3">
                  <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
                    {t.app.withdraw.to}
                  </span>
                  <code className="mt-1 block font-mono text-[12px] break-all">
                    <span className="ltr-num">{address.trim()}</span>
                  </code>
                </div>
                {/* The destination and what actually arrives, restated at the
                    last step — this is the screen someone reads before an
                    irreversible transfer. */}
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-[13px] text-[var(--mute)]">
                    {t.app.withdraw.destination}
                  </span>
                  <span className="text-[13px] font-semibold">
                    {DEST_CHAINS.find((c) => c.id === destChainId)?.label ?? destChainId}
                  </span>
                </div>
                {destChainId !== POLYGON_ID && quote && (
                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--mute)]">
                    {t.app.withdraw.quoteLine
                      .replace("{out}", quote.out)
                      .replace("{symbol}", quote.symbol)}
                  </p>
                )}
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-[var(--faint)]">
                {t.app.withdraw.note}
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
                {submitting ? (
                  t.app.withdraw.sending
                ) : (
                  <>
                    {t.app.withdraw.send}{" "}
                    <span className="ltr-num">{usd(round2(parsed))}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirming(false)}
                className="mt-2 min-h-[40px] w-full text-[13px] text-[var(--mute)]"
              >
                {t.app.withdraw.back}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
