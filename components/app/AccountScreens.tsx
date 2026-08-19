"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { usd, cents } from "@/lib/format";
import { authedGet, authedPost, ApiCallError, type ApiFailure } from "@/lib/client-api";
import { botLink, useTelegram } from "@/lib/telegram";
import { SignInButton } from "./SignInButton";
import { WithdrawSheet, type WithdrawSent } from "./WithdrawSheet";
import { useLocale } from "./LocaleProvider";

export type Position = {
  marketId: string;
  slug: string;
  title: string;
  side: string;
  shares: number;
  stake: number;
  avgPrice: number;
  curPrice: number;
  value: number;
  pnl: number;
  pnlPct: number;
  progress: number;
  settled: boolean;
  won: boolean;
};

export type Account = {
  balance: number;
  walletAddress: string | null;
  depositWalletAddress: string | null;
  displayName: string | null;
  locale: string;
};

type State<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "failed"; kind: ApiFailure };

/** Bumping this re-runs the fetch — used to re-read the balance after a withdrawal. */
function useAuthed<T>(path: string): State<T> & { reload: () => void } {
  const [state, setState] = useState<State<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    authedGet<T>(path, ctrl.signal)
      .then((data) => setState({ status: "ready", data }))
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setState({
          status: "failed",
          kind: e instanceof ApiCallError ? e.kind : "unavailable",
        });
      });
    return () => ctrl.abort();
  }, [path, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}

/** Every non-ready state gets a message that says what to actually do next. */
function Failure({ kind }: { kind: ApiFailure }) {
  const { t } = useLocale();
  const { inTelegram } = useTelegram();

  if (kind === "unauthenticated") {
    // Two different failures wear this label. On the web it means "not signed
    // in", and signing in fixes it. Inside Telegram it means initData was
    // missing or rejected — the known cloned-client problem — and no amount of
    // signing in helps, so those users still get pointed at the bot.
    if (inTelegram) {
      return (
        <div className="px-4 py-12 text-center">
          <p className="text-[14px] text-[var(--mute)]">{t.app.errors.telegramSession}</p>
          <a
            href={botLink()}
            className="mt-4 inline-block min-h-[46px] rounded-xl bg-[var(--ink)] px-5 py-3 text-[14px] font-semibold text-[var(--on-ink)]"
          >
            {t.app.errors.openTelegram}
          </a>
        </div>
      );
    }
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-[14px] text-[var(--mute)]">{t.app.errors.signInPrompt}</p>
        <div className="mt-4">
          <SignInButton className="inline-block min-h-[46px] rounded-xl bg-[var(--ink)] px-5 py-3 text-[14px] font-semibold text-[var(--on-ink)]" />
        </div>
      </div>
    );
  }

  if (kind === "no_account") {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-[14px] text-[var(--mute)]">{t.app.errors.noWallet}</p>
        <a
          href={botLink()}
          className="mt-4 inline-block min-h-[46px] rounded-xl bg-[var(--ink)] px-5 py-3 text-[14px] font-semibold text-[var(--on-ink)]"
        >
          {t.app.errors.setUpWallet}
        </a>
      </div>
    );
  }

  const message =
    kind === "blocked"
      ? t.app.errors.blocked
      : kind === "rate_limited"
        ? t.app.errors.rateLimited
        : t.app.errors.unavailable;

  return <p className="px-4 py-12 text-center text-[14px] text-[var(--down)]">{message}</p>;
}

/** A settled/closed pick from the DB (persists after redemption; carries the
 *  closed timestamp the "Settled" tab sorts by). Source: GET /webapp/v1/history. */
export type HistoryRow = {
  marketId: string;
  slug: string;
  title: string;
  side: string;
  stake: number;
  avgPrice: number;
  pnl: number;
  pnlPct: number;
  settledAt: string | null;
  won: boolean;
};

export function PositionsScreen({ onOpenMarket }: { onOpenMarket: (slug: string) => void }) {
  const { t } = useLocale();
  const [tab, setTab] = useState<"open" | "settled">("open");
  const state = useAuthed<{ positions: Position[] }>("/webapp/v1/positions");
  const [manage, setManage] = useState<Position | null>(null);

  if (state.status === "loading")
    return <p className="px-4 py-12 text-center text-[var(--mute)]">{t.app.positions.loading}</p>;
  if (state.status === "failed") return <Failure kind={state.kind} />;

  // "Open" = everything currently held on-chain (including a redeemable winner
  // awaiting its claim); "Settled" comes from the persistent history endpoint.
  const held = state.data.positions;
  const openOnly = held.filter((p) => !p.settled);

  /*
   * A resolved LOSER is not an open position, and it cannot be left in the list.
   *
   * Losing shares stay in the wallet forever — nothing burns them — and the data
   * API reports them redeemable (the market did resolve) at curPrice 0. So the
   * row never ages out: it sits under Open at $0 offering a Manage button whose
   * only possible outcome is "this market resolved against your position —
   * nothing to redeem". The result it belongs to is already in the Settled tab.
   *
   * The test is deliberately conservative rather than simply `!p.won`. `won` is
   * derived from a live CLOB price, which can be missing on a market that has
   * already resolved, so trusting it alone risks hiding a WINNER and taking away
   * the only route to their claim. Requiring the position to be worthless AND
   * at a loss means the failure direction is a dead row shown, never a claim
   * hidden.
   */
  const deadLoss = (p: Position) => p.settled && !p.won && p.value < 0.01 && p.pnl < 0;
  const shown = held.filter((p) => !deadLoss(p));
  const openValue = openOnly.reduce((a, p) => a + p.value, 0);
  const unrealized = openOnly.reduce((a, p) => a + p.pnl, 0);

  return (
    <div className="px-4 pb-28">
      <h1 className="py-4 text-[20px] font-bold tracking-[-0.02em]">{t.app.positions.title}</h1>

      <div className="flex gap-3">
        <Tile label={t.app.positions.openValue} value={usd(openValue)} />
        <Tile
          label={t.app.positions.unrealized}
          value={`${unrealized >= 0 ? "+" : "−"}${usd(Math.abs(unrealized))}`}
          color={unrealized >= 0 ? "var(--up)" : "var(--down)"}
        />
      </div>

      <div className="mt-4 flex gap-2" role="tablist">
        {(["open", "settled"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`min-h-[44px] flex-1 rounded-xl font-mono text-[12px] tracking-[0.04em] uppercase ${
              tab === key
                ? "bg-[var(--ink)] text-[var(--on-ink)]"
                : "border border-[var(--line)] bg-[var(--btn)] text-[var(--mute)]"
            }`}
          >
            {key === "open" ? t.app.positions.tabOpen : t.app.positions.tabSettled}
          </button>
        ))}
      </div>

      {tab === "open" ? (
        shown.length === 0 ? (
          <p className="py-12 text-center text-[14px] text-[var(--mute)]">
            {t.app.positions.emptyOpen}
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2.5">
            {shown.map((p) => (
              <PositionCard
                key={`${p.marketId}-${p.side}`}
                p={p}
                onOpen={() => onOpenMarket(p.slug)}
                onManage={() => setManage(p)}
              />
            ))}
          </ul>
        )
      ) : (
        <SettledList onOpenMarket={onOpenMarket} />
      )}

      {manage && (
        <ReduceSheet
          position={manage}
          onClose={() => setManage(null)}
          onDone={() => {
            setManage(null);
            state.reload();
          }}
        />
      )}
    </div>
  );
}

/** One open/held position. Tapping the body opens the market detail (where the
 *  bet slip doubles as "add to position"); the Manage button opens the close/
 *  reduce sheet, or Claim for a resolved winner. */
function PositionCard({
  p,
  onOpen,
  onManage,
}: {
  p: Position;
  onOpen: () => void;
  onManage: () => void;
}) {
  const { t } = useLocale();
  const claimable = p.settled && p.won;
  return (
    <li className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
      <button type="button" onClick={onOpen} className="block w-full text-start">
        <h2 className="text-[14px] leading-snug font-semibold">{p.title}</h2>
        <div className="mt-2 flex items-center justify-between font-mono text-[12px]">
          <span className="text-[var(--mute)]">
            {p.side} · <span className="ltr-num">{p.shares.toFixed(1)}</span>{" "}
            {t.app.positions.shares}
          </span>
          <span className="ltr-num" style={{ color: p.pnl >= 0 ? "var(--up)" : "var(--down)" }}>
            {p.pnl >= 0 ? "+" : "−"}
            {usd(Math.abs(p.pnl))}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-[var(--faint)]">
          <span>
            {t.app.positions.cost} <span className="ltr-num">{usd(p.stake)}</span>
          </span>
          <span>
            {t.app.positions.worth} <span className="ltr-num">{usd(p.value)}</span>
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bar)]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, Math.max(0, p.progress))}%`,
              background: p.pnl >= 0 ? "var(--up)" : "var(--down)",
            }}
          />
        </div>
      </button>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-h-[40px] flex-1 rounded-xl border border-[var(--line)] bg-[var(--btn)] text-[13px] font-semibold text-[var(--ink)]"
        >
          {t.app.positions.viewAdd}
        </button>
        <button
          type="button"
          onClick={onManage}
          className="min-h-[40px] flex-1 rounded-xl border border-[var(--line)] bg-[var(--btn)] text-[13px] font-semibold"
          style={{ color: claimable ? "var(--up)" : "var(--ink)" }}
        >
          {claimable ? t.app.positions.claimWinnings : t.app.positions.reduceClose}
        </button>
      </div>
    </li>
  );
}

/** The "Settled" tab: closed/resolved results from history, with won/lost
 *  filters and recent/biggest sorting. */
function SettledList({ onOpenMarket }: { onOpenMarket: (slug: string) => void }) {
  const { t, tf } = useLocale();
  const state = useAuthed<{ history: HistoryRow[] }>("/webapp/v1/history");
  const [filter, setFilter] = useState<"all" | "won" | "lost">("all");
  const [sort, setSort] = useState<"date" | "pnl">("date");

  if (state.status === "loading")
    return <p className="py-12 text-center text-[var(--mute)]">{t.app.positions.loading}</p>;
  if (state.status === "failed") return <Failure kind={state.kind} />;

  let rows = state.data.history.filter((r) =>
    filter === "won" ? r.pnl >= 0 : filter === "lost" ? r.pnl < 0 : true,
  );
  rows = [...rows].sort((a, b) =>
    sort === "pnl" ? b.pnl - a.pnl : (b.settledAt ?? "").localeCompare(a.settledAt ?? ""),
  );
  const total = rows.reduce((s, r) => s + r.pnl, 0);

  const pill = (active: boolean, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[38px] flex-1 rounded-xl font-mono text-[11px] tracking-[0.03em] ${
        active
          ? "bg-[var(--ink)] text-[var(--on-ink)]"
          : "border border-[var(--line)] bg-[var(--btn)] text-[var(--mute)]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        {pill(filter === "all", t.app.positions.filterAll, () => setFilter("all"))}
        {pill(filter === "won", t.app.positions.filterWon, () => setFilter("won"))}
        {pill(filter === "lost", t.app.positions.filterLost, () => setFilter("lost"))}
      </div>
      <div className="mt-2 flex gap-2">
        {pill(sort === "date", t.app.positions.sortRecent, () => setSort("date"))}
        {pill(sort === "pnl", t.app.positions.sortBiggest, () => setSort("pnl"))}
      </div>

      {rows.length === 0 ? (
        <p className="py-12 text-center text-[14px] text-[var(--mute)]">
          {t.app.positions.emptySettled}
        </p>
      ) : (
        <>
          <p className="mt-4 flex items-center justify-between font-mono text-[11px] text-[var(--faint)]">
            <span>{tf(t.app.positions.settledCount, { n: rows.length })}</span>
            <span style={{ color: total >= 0 ? "var(--up)" : "var(--down)" }}>
              {t.app.positions.net}{" "}
              <span className="ltr-num">
                {total >= 0 ? "+" : "−"}
                {usd(Math.abs(total))}
              </span>
            </span>
          </p>
          <ul className="mt-2 flex flex-col gap-2.5">
            {rows.map((r) => (
              <SettledCard key={`${r.marketId}-${r.side}-${r.settledAt}`} r={r} onOpen={() => onOpenMarket(r.slug)} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SettledCard({ r, onOpen }: { r: HistoryRow; onOpen: () => void }) {
  const { t } = useLocale();
  const when = r.settledAt ? new Date(r.settledAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
  return (
    <li className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
      <button type="button" onClick={onOpen} className="block w-full text-start">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[14px] leading-snug font-semibold">
            {r.won ? "✅ " : "🔴 "}
            {r.title}
          </h2>
          <span
            className="ltr-num shrink-0 font-mono text-[13px] font-semibold"
            style={{ color: r.pnl >= 0 ? "var(--up)" : "var(--down)" }}
          >
            {r.pnl >= 0 ? "+" : "−"}
            {usd(Math.abs(r.pnl))}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-[var(--faint)]">
          <span>
            {r.side} · {t.app.positions.staked}{" "}
            <span className="ltr-num">{usd(r.stake)}</span>
            {r.stake > 0 ? (
              <span className="ltr-num">
                {` · ${r.pnlPct >= 0 ? "+" : ""}${r.pnlPct.toFixed(0)}%`}
              </span>
            ) : null}
          </span>
          <span>{when}</span>
        </div>
      </button>
    </li>
  );
}

/** Close / reduce a position. A resolved winner claims 1:1; an open position
 *  sells a chosen fraction (25/50/75/all) into the book with a confirm step
 *  showing the live proceeds. Posts to /webapp/v1/close. */
function ReduceSheet({
  position,
  onClose,
  onDone,
}: {
  position: Position;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, tf } = useLocale();
  const claimable = position.settled && position.won;
  const [pct, setPct] = useState<number>(claimable ? 100 : 50);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sellShares = claimable ? position.shares : position.shares * (pct / 100);
  const estProceeds = claimable ? position.shares : sellShares * position.curPrice;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await authedPost<{ ok: boolean }>("/webapp/v1/close", {
        slug: position.slug,
        outcome: position.side,
        pct: claimable ? 100 : pct,
      });
      onDone();
    } catch (e) {
      const server = (e as ApiCallError & { serverMessage?: string })?.serverMessage;
      setError(server ?? t.app.positions.closeError);
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
        aria-label={claimable ? t.app.positions.claimWinnings : t.app.positions.closeSheetLabel}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--handle)]" />
        <div className="mx-auto max-w-md">
          <h2 className="text-[18px] font-bold tracking-[-0.02em]">
            {claimable ? t.app.positions.claimWinnings : t.app.positions.reduceTitle}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--mute)]">{position.title}</p>
          <p className="mt-0.5 font-mono text-[11px] text-[var(--faint)]">
            {position.side} · <span className="ltr-num">{position.shares.toFixed(1)}</span>{" "}
            {t.app.positions.shares} {t.app.bet.at}{" "}
            <span className="ltr-num">{cents(position.curPrice)}</span>
          </p>

          {!claimable && (
            <div className="mt-4 flex gap-2">
              {[25, 50, 75, 100].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPct(v)}
                  className={`min-h-[44px] flex-1 rounded-xl font-mono text-[13px] font-semibold ${
                    pct === v
                      ? "bg-[var(--ink)] text-[var(--on-ink)]"
                      : "border border-[var(--line)] bg-[var(--btn)] text-[var(--mute)]"
                  }`}
                >
                  {v === 100 ? t.app.positions.all : tf(t.app.positions.pctChip, { p: v })}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between rounded-xl bg-[var(--btn)] px-4 py-3">
            <span className="text-[13px] text-[var(--mute)]">
              {claimable
                ? t.app.positions.redeemsFor
                : tf(t.app.positions.sellApprox, { shares: sellShares.toFixed(1) })}
            </span>
            <span
              className="ltr-num font-mono text-[17px] font-bold"
              style={{ color: "var(--up)" }}
            >
              {usd(estProceeds)}
            </span>
          </div>

          {!claimable && (
            <p className="mt-2 font-mono text-[11px] text-[var(--faint)]">
              {t.app.positions.estimateNote}
            </p>
          )}

          {error && (
            <p className="mt-3 rounded-lg bg-[color-mix(in_srgb,var(--down)_12%,transparent)] px-3 py-2 text-[13px] text-[var(--down)]">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="mt-4 min-h-[52px] w-full rounded-2xl bg-[var(--ink)] text-[16px] font-bold text-[var(--on-ink)] disabled:opacity-50"
          >
            {submitting ? (
              t.app.positions.processing
            ) : claimable ? (
              <>
                {t.app.positions.claim} <span className="ltr-num">{usd(estProceeds)}</span>
              </>
            ) : pct === 100 ? (
              t.app.positions.sellAll
            ) : (
              tf(t.app.positions.sellPct, { p: pct })
            )}
          </button>
          <p className="mt-3 text-center font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
            {t.app.bet.signedOnChain}
          </p>
        </div>
      </div>
    </>
  );
}

export function WalletScreen() {
  const { t } = useLocale();
  const state = useAuthed<Account>("/webapp/v1/me");
  const [sheet, setSheet] = useState<"deposit" | "withdraw" | null>(null);
  const [sent, setSent] = useState<WithdrawSent | null>(null);
  const [showAddresses, setShowAddresses] = useState(false);

  if (state.status === "loading")
    return <p className="px-4 py-12 text-center text-[var(--mute)]">{t.app.positions.loading}</p>;
  if (state.status === "failed") return <Failure kind={state.kind} />;

  const data = state.data;
  const addr = data.depositWalletAddress ?? data.walletAddress;

  return (
    <div className="px-4 pb-28">
      <h1 className="py-4 text-[20px] font-bold tracking-[-0.02em]">{t.app.wallet.title}</h1>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
        <div className="font-mono text-[10px] tracking-[0.08em] text-[var(--faint)]">
          {t.app.wallet.availableBalance}
        </div>
        <div className="mt-1 font-mono text-[30px] font-bold">
          <span className="ltr-num">{usd(data.balance)}</span>
        </div>
        <p className="mt-1 text-[12px] text-[var(--mute)]">{t.app.wallet.custody}</p>

        {/* Both actions live here now. Withdrawal used to point at the bot,
            which is a dead end for anyone who signed up with Google or a
            wallet — they have no Telegram chat, so they could fund an account
            and bet from it but never get the money back out. */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setSheet("deposit")}
            className="min-h-[48px] flex-1 rounded-xl bg-[var(--ink)] font-semibold text-[var(--on-ink)]"
          >
            {t.app.wallet.deposit}
          </button>
          <button
            type="button"
            onClick={() => setSheet("withdraw")}
            disabled={data.balance <= 0}
            className="min-h-[48px] flex-1 rounded-xl border border-[var(--line)] bg-[var(--btn)] font-semibold text-[var(--ink)] disabled:opacity-40"
          >
            {t.app.wallet.withdraw}
          </button>
        </div>
      </div>

      {/* On-chain addresses, collapsed by default.
          These were previously two copyable address blocks sitting directly
          under the Deposit button, one of them captioned "deposit USDC here".
          That is a trap: the Deposit sheet now hands out a DIFFERENT address
          per network, so a user who copies from here instead is sending on a
          network these addresses can't receive — and the signer wallet credits
          nothing at all. They stay reachable for looking up a profile or a
          block explorer, but they are reference data, not an action, and the
          UI now says so before it shows them. */}
      {(data.depositWalletAddress || data.walletAddress) && (
        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
          <button
            type="button"
            onClick={() => setShowAddresses((v) => !v)}
            aria-expanded={showAddresses}
            className="flex w-full items-center justify-between gap-3 text-start"
          >
            <span className="font-mono text-[10px] tracking-[0.08em] text-[var(--faint)] uppercase">
              {t.app.wallet.accounts}
            </span>
            <span className="text-[13px] font-semibold text-[var(--mute)]">
              {showAddresses ? t.app.wallet.accountsHide : t.app.wallet.accountsShow}
            </span>
          </button>

          {showAddresses && (
            <>
              <p className="mt-3 rounded-xl bg-[color-mix(in_srgb,var(--down)_10%,transparent)] px-3 py-2.5 text-[12px] leading-relaxed text-[var(--down)]">
                {t.app.wallet.accountsWarning}
              </p>
              <div className="mt-4 flex flex-col gap-4">
                {data.depositWalletAddress && (
                  <AddressRow
                    label={t.app.wallet.polymarketLabel}
                    address={data.depositWalletAddress}
                    sublabel={t.app.wallet.polymarketSub}
                    link={{
                      href: `https://polymarket.com/profile/${data.depositWalletAddress}`,
                      text: t.app.wallet.viewOnPolymarket,
                    }}
                  />
                )}
                {data.walletAddress && data.walletAddress !== data.depositWalletAddress && (
                  <AddressRow
                    label={t.app.wallet.privyLabel}
                    address={data.walletAddress}
                    tone="warn"
                    sublabel={t.app.wallet.privySub}
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}

      {sheet === "deposit" && addr && (
        <DepositSheet address={addr} onClose={() => setSheet(null)} />
      )}

      {sheet === "withdraw" && (
        <WithdrawSheet
          balance={data.balance}
          onClose={() => setSheet(null)}
          onSent={(s) => {
            setSheet(null);
            setSent(s);
            // The balance on screen is now stale by exactly the amount sent.
            // Re-read rather than subtracting locally: the chain is the truth,
            // and a local guess would disagree the moment a bet settles.
            state.reload();
          }}
        />
      )}

      {sent && (
        <div className="fixed inset-x-0 bottom-20 z-50 mx-auto max-w-md px-4">
          <div className="rounded-xl bg-[var(--ink)] px-4 py-3 text-[13px] text-[var(--on-ink)]">
            <div className="font-semibold">
              {t.app.wallet.sent} <span className="ltr-num">{usd(sent.amountUsdc)}</span>
            </div>
            <div className="mt-0.5 font-mono text-[10px] opacity-70">
              {sent.txHash ? (
                <span className="ltr-num">{`${sent.txHash.slice(0, 10)}…`}</span>
              ) : (
                t.app.wallet.confirming
              )}
            </div>
            <button
              type="button"
              onClick={() => setSent(null)}
              className="mt-1 text-[11px] underline opacity-70"
            >
              {t.app.wallet.dismiss}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Funding rails, as offered by GET /webapp/v1/deposit.
 *
 * `id` keys the copy in the dictionary; `vault` marks the Depositron rail,
 * which accepts any token on that chain rather than USDC specifically.
 */
type DepositRail = { id: string; chainId: number | null; address: string; vault: boolean };

/** Rails in the order they should be offered, easiest funding path first. */
const RAIL_ORDER = ["56", "42161", "8453", "tron", "evm", "svm", "btc", "polygon"];

/**
 * Deposit: pick a chain, then its address + QR and the network warning.
 *
 * This used to show one address — USDC.e on Polygon — which is the rail almost
 * nobody in the Persian audience can actually reach; they hold USDT on BSC or
 * Tron. The bot has offered the vault and bridge rails for weeks, so the sheet
 * now asks the server which rails apply to this user and renders the same set.
 *
 * `fallbackAddress` keeps the sheet useful if that call fails: the Polygon
 * proxy address is already on screen in the Wallet, so the worst case is
 * exactly the behaviour this replaced rather than an empty sheet.
 */
function DepositSheet({
  address: fallbackAddress,
  onClose,
}: {
  address: string;
  onClose: () => void;
}) {
  const { t, tf } = useLocale();
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [rails, setRails] = useState<DepositRail[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    authedGet<{ rails: DepositRail[] }>("/webapp/v1/deposit", ctrl.signal)
      .then((d) => {
        const sorted = [...d.rails].sort(
          (a, b) => railRank(a.id) - railRank(b.id),
        );
        setRails(sorted);
        setPicked((p) => p ?? sorted[0]?.id ?? null);
      })
      .catch(() => {
        // Degrade to the single Polygon rail rather than blocking deposits.
        setRails([]);
      });
    return () => ctrl.abort();
  }, []);

  const rail = rails?.find((r) => r.id === picked) ?? null;
  const address = rail?.address ?? fallbackAddress;
  const railCopy = (r: DepositRail) =>
    (t.app.wallet.rails as Record<string, { title: string; blurb: string }>)[r.id];

  // Generated in the browser rather than by an image service: handing a user's
  // deposit address to a third-party host to render would leak exactly the thing
  // the sheet exists to protect.
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(address, { width: 360, margin: 1 })
      .then((url) => {
        if (live) setQr(url);
      })
      .catch(() => {
        // The address and copy button below are the real affordance; a missing
        // QR is a downgrade, not a failure.
      });
    return () => {
      live = false;
    };
  }, [address]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <div
        className="oz-sheet fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-[var(--line)] bg-[var(--paper)] p-5 pb-8"
        role="dialog"
        aria-modal="true"
        aria-label={t.app.wallet.deposit}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--handle)]" />
        <div className="mx-auto max-w-md text-center">
          <h2 className="text-[18px] font-bold tracking-[-0.02em]">{t.app.wallet.depositTitle}</h2>

          {rails && rails.length > 1 && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {rails.map((r) => {
                const active = r.id === picked;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setPicked(r.id)}
                    aria-pressed={active}
                    className="min-h-[36px] rounded-xl border px-3 text-[13px] font-semibold"
                    style={{
                      borderColor: active ? "var(--accent)" : "var(--line)",
                      color: active ? "var(--accent)" : "var(--mute)",
                      background: active
                        ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                        : "var(--btn)",
                    }}
                  >
                    {railCopy(r)?.title ?? r.id}
                  </button>
                );
              })}
            </div>
          )}

          <p className="mt-3 text-[13px] leading-relaxed text-[var(--mute)]">
            {(rail && railCopy(rail)?.blurb) ?? t.app.wallet.depositNetwork}
          </p>

          {qr && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qr}
              alt={tf(t.app.wallet.qrAlt, { address })}
              width={180}
              height={180}
              className="mx-auto mt-4 h-[180px] w-[180px] rounded-xl bg-white p-2"
            />
          )}

          <code className="mt-4 block font-mono text-[12px] break-all">
            <span className="ltr-num">{address}</span>
          </code>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(address);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
            className="mt-4 min-h-[48px] w-full rounded-2xl bg-[var(--ink)] font-semibold text-[var(--on-ink)]"
          >
            {copied ? t.app.wallet.copied : t.app.wallet.copyAddress}
          </button>

          {/*
            The Polygon rail gets its OWN warning, naming the token and its
            contract address.
            
            "USDC on Polygon" is ambiguous in the one way that costs money:
            Polygon has TWO tokens with that name, and only the bridged one
            (USDC.e, 0x2791…) is watched. Native USDC (0x3c49…) is what almost
            every exchange sends by default, it lands in the proxy, and the
            watcher never sees it — the money arrives and the balance never
            moves. That has already happened once. The generic warning below
            said "USDC on Polygon only", which a sender of native USDC reads as
            confirmation they did the right thing.
          */}
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--faint)]">
            {rail?.vault
              ? t.app.wallet.depositWarningVault
              : picked === "polygon" || rails?.length === 0
                ? t.app.wallet.depositWarningPolygon
                : t.app.wallet.depositWarning}
          </p>
        </div>
      </div>
    </>
  );
}

/** One labeled address block: mono address, per-row copy, a sublabel/warning,
 *  and an optional external link (e.g. "View on Polymarket ↗"). */
function AddressRow({
  label,
  address,
  sublabel,
  tone,
  link,
}: {
  label: string;
  address: string;
  sublabel: string;
  tone?: "warn";
  link?: { href: string; text: string };
}) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.08em] text-[var(--faint)]">
          {label}
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="min-h-[32px] shrink-0 rounded-lg border border-[var(--line)] bg-[var(--btn)] px-3 font-mono text-[11px] text-[var(--mute)]"
        >
          {copied ? t.app.wallet.copied : t.app.wallet.copy}
        </button>
      </div>
      <code className="mt-1 block font-mono text-[12px] break-all">
        <span className="ltr-num">{address}</span>
      </code>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p
          className={`text-[11px] leading-relaxed ${
            tone === "warn" ? "text-[var(--down)]" : "text-[var(--faint)]"
          }`}
        >
          {sublabel}
        </p>
        {link && (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 font-mono text-[11px] whitespace-nowrap text-[var(--accent)] underline"
          >
            {link.text}
          </a>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex-1 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
      <div className="font-mono text-[9px] tracking-[0.08em] text-[var(--faint)]">{label}</div>
      <div className="mt-1 font-mono text-[18px] font-bold" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

/** Sort key for a rail id; anything unknown sorts to the end. */
function railRank(id: string): number {
  const i = RAIL_ORDER.indexOf(id);
  return i === -1 ? RAIL_ORDER.length : i;
}
