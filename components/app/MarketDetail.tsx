"use client";

import { useState } from "react";
import type { Market } from "@/lib/api";
import { cents, compactUsd, pct, payoutFor, shortDate, usd } from "@/lib/format";
import { authedPost, ApiCallError } from "@/lib/client-api";
import { useTelegram } from "@/lib/telegram";
import { useLocale } from "./LocaleProvider";

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
 * payout preview → confirm. Placement POSTs to the bot's /webapp/v1/bet, which
 * runs the same placeBetCore the chat flow uses.
 *
 * The price shown here is the cached snapshot probability, which is fine for a
 * preview but is NOT what the order is capped against — the server re-quotes
 * the executable price at placement time and returns the actual fill, so the
 * receipt reflects what really happened rather than what we predicted.
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
  const { t, tf } = useLocale();
  const { inTelegram } = useTelegram();
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
      const data = await authedPost<{
        filledShares: number;
        costUsd: number;
        avgPrice: number;
        orderId: string | null;
        txHash: string | null;
      }>("/webapp/v1/bet", { marketId: market.id, side, sizeUsdc: stake });

      onPlaced({
        market,
        side,
        stake: data.costUsd,
        price: data.avgPrice,
        shares: data.filledShares,
        payout: data.filledShares,
        txHash: data.txHash,
        orderId: data.orderId,
      });
    } catch (e) {
      const server = (e as ApiCallError & { serverMessage?: string })?.serverMessage;
      if (e instanceof ApiCallError && e.kind === "unauthenticated") {
        // The gate normally stops a signed-out visitor long before here, so in
        // practice this is a session that expired mid-slip.
        setError(
          inTelegram ? t.app.errors.telegramSession : t.app.bet.sessionExpired,
        );
      } else {
        setError(server ?? t.app.bet.failed);
      }
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
          {t.app.detail.back}
        </button>
      </div>

      <div className="px-4">
        <h1 className="text-[19px] leading-snug font-bold tracking-[-0.02em]">
          {market.title}
        </h1>

        {/* Probability ring */}
        <div className="mt-5 flex items-center gap-5">
          <ProbabilityRing value={yesPct} yesLabel={t.app.bet.yes} />
          <div className="flex flex-col gap-2">
            <Stat label={t.app.detail.volume} value={compactUsd(market.volume.total)} />
            <Stat label={t.app.detail.h24} value={compactUsd(market.volume.h24)} />
            <Stat label={t.app.detail.resolves} value={shortDate(market.close_time)} />
          </div>
        </div>

        {market.category && (
          <p className="mt-4 font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
            {market.category.name.toUpperCase()}
          </p>
        )}

        <section className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
          <h2 className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
            {t.app.detail.resolutionTitle}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--text2)]">
            {t.app.detail.resolutionBody}
          </p>
          <a
            href={market.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block font-mono text-[11px] text-[var(--accent)]"
          >
            {t.app.detail.viewOnPolymarket}
          </a>
        </section>

        <p className="mt-4 text-[11px] leading-relaxed text-[var(--faint)]">
          {t.app.detail.risk}
        </p>
      </div>

      {/* Sticky side picker */}
      <div className="fixed inset-x-0 bottom-[64px] z-30 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--page)_92%,transparent)] p-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-md gap-2">
          <SideButton
            side="YES"
            label={t.app.bet.yes}
            active={side === "YES"}
            price={market.probability.yes}
            onClick={() => {
              setSide("YES");
              setSheetOpen(true);
            }}
          />
          <SideButton
            side="NO"
            label={t.app.bet.no}
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
            aria-label={t.app.bet.sheetLabel}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--handle)]" />

            <div className="mx-auto max-w-md">
              <div className="flex gap-2">
                <SideButton
                  side="YES"
                  label={t.app.bet.yes}
                  active={side === "YES"}
                  price={market.probability.yes}
                  onClick={() => setSide("YES")}
                />
                <SideButton
                  side="NO"
                  label={t.app.bet.no}
                  active={side === "NO"}
                  price={market.probability.no}
                  onClick={() => setSide("NO")}
                />
              </div>

              <div className="mt-5 flex items-baseline justify-between">
                <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
                  {t.app.bet.stake}
                </span>
                <span className="ltr-num font-mono text-[26px] font-semibold">{usd(stake)}</span>
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
                <span className="sr-only">{t.app.bet.customStakeLabel}</span>
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
                  placeholder={t.app.bet.customStakePlaceholder}
                />
              </label>

              <div className="mt-4 flex items-center justify-between rounded-xl bg-[var(--btn)] px-4 py-3">
                <span className="text-[13px] text-[var(--mute)]">{t.app.bet.payoutIfCorrect}</span>
                <span className="ltr-num font-mono text-[17px] font-bold text-[var(--up)]">
                  {usd(payout)}
                </span>
              </div>

              <p className="mt-2 flex justify-between font-mono text-[11px] text-[var(--faint)]">
                <span>
                  <span className="ltr-num">{shares.toFixed(1)}</span> {t.app.bet.shares}{" "}
                  {t.app.bet.at} <span className="ltr-num">{cents(price)}</span>
                </span>
                {balance != null && (
                  <span>
                    {t.app.bet.balance} <span className="ltr-num">{usd(balance)}</span>
                  </span>
                )}
              </p>

              {insufficient && (
                <p className="mt-3 text-[13px] text-[var(--down)]">
                  {t.app.bet.insufficient}
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
                {submitting ? (
                  t.app.bet.placing
                ) : (
                  <>
                    {tf(t.app.bet.place, { side: side === "YES" ? t.app.bet.yes : t.app.bet.no })} ·{" "}
                    <span className="ltr-num">{usd(stake)}</span>
                  </>
                )}
              </button>

              <p className="mt-3 text-center font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
                {t.app.bet.signedOnChain}
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
  label,
  active,
  price,
  onClick,
}: {
  side: "YES" | "NO";
  /** Localised YES/NO wording; `side` stays the untranslated logical value. */
  label: string;
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
      {label} · <span className="ltr-num">{cents(price)}</span>
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

function ProbabilityRing({ value, yesLabel }: { value: number; yesLabel: string }) {
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
          {yesLabel}
        </span>
      </div>
    </div>
  );
}
