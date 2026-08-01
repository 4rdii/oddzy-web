"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { usd, cents } from "@/lib/format";
import { authedGet, authedPost, ApiCallError, type ApiFailure } from "@/lib/client-api";
import { botLink, useTelegram } from "@/lib/telegram";
import { SignInButton } from "./SignInButton";
import { WithdrawSheet, type WithdrawSent } from "./WithdrawSheet";

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
  const { inTelegram } = useTelegram();

  if (kind === "unauthenticated") {
    // Two different failures wear this label. On the web it means "not signed
    // in", and signing in fixes it. Inside Telegram it means initData was
    // missing or rejected — the known cloned-client problem — and no amount of
    // signing in helps, so those users still get pointed at the bot.
    if (inTelegram) {
      return (
        <div className="px-4 py-12 text-center">
          <p className="text-[14px] text-[var(--mute)]">
            We couldn&apos;t verify your Telegram session. Reopen Oddzy from the bot.
          </p>
          <a
            href={botLink()}
            className="mt-4 inline-block min-h-[46px] rounded-xl bg-[var(--ink)] px-5 py-3 text-[14px] font-semibold text-[var(--on-ink)]"
          >
            Open in Telegram
          </a>
        </div>
      );
    }
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-[14px] text-[var(--mute)]">
          Sign in to see your wallet and positions.
        </p>
        <div className="mt-4">
          <SignInButton className="inline-block min-h-[46px] rounded-xl bg-[var(--ink)] px-5 py-3 text-[14px] font-semibold text-[var(--on-ink)]" />
        </div>
      </div>
    );
  }

  if (kind === "no_account") {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-[14px] text-[var(--mute)]">
          You don&apos;t have a wallet yet.
        </p>
        <a
          href={botLink()}
          className="mt-4 inline-block min-h-[46px] rounded-xl bg-[var(--ink)] px-5 py-3 text-[14px] font-semibold text-[var(--on-ink)]"
        >
          Set up your wallet
        </a>
      </div>
    );
  }

  const message =
    kind === "blocked"
      ? "This account can't access Oddzy."
      : kind === "rate_limited"
        ? "Too many requests — give it a minute."
        : "Couldn't reach the server. Try again shortly.";

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
  const [tab, setTab] = useState<"open" | "settled">("open");
  const state = useAuthed<{ positions: Position[] }>("/webapp/v1/positions");
  const [manage, setManage] = useState<Position | null>(null);

  if (state.status === "loading")
    return <p className="px-4 py-12 text-center text-[var(--mute)]">Loading…</p>;
  if (state.status === "failed") return <Failure kind={state.kind} />;

  // "Open" = everything currently held on-chain (including a redeemable winner
  // awaiting its claim); "Settled" comes from the persistent history endpoint.
  const held = state.data.positions;
  const openOnly = held.filter((p) => !p.settled);
  const openValue = openOnly.reduce((a, p) => a + p.value, 0);
  const unrealized = openOnly.reduce((a, p) => a + p.pnl, 0);

  return (
    <div className="px-4 pb-28">
      <h1 className="py-4 text-[20px] font-bold tracking-[-0.02em]">Positions</h1>

      <div className="flex gap-3">
        <Tile label="OPEN VALUE" value={usd(openValue)} />
        <Tile
          label="UNREALIZED P&L"
          value={`${unrealized >= 0 ? "+" : "−"}${usd(Math.abs(unrealized))}`}
          color={unrealized >= 0 ? "var(--up)" : "var(--down)"}
        />
      </div>

      <div className="mt-4 flex gap-2" role="tablist">
        {(["open", "settled"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-[44px] flex-1 rounded-xl font-mono text-[12px] tracking-[0.04em] uppercase ${
              tab === t
                ? "bg-[var(--ink)] text-[var(--on-ink)]"
                : "border border-[var(--line)] bg-[var(--btn)] text-[var(--mute)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "open" ? (
        held.length === 0 ? (
          <p className="py-12 text-center text-[14px] text-[var(--mute)]">No open positions yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2.5">
            {held.map((p) => (
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
  const claimable = p.settled && p.won;
  return (
    <li className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
      <button type="button" onClick={onOpen} className="block w-full text-start">
        <h2 className="text-[14px] leading-snug font-semibold">{p.title}</h2>
        <div className="mt-2 flex items-center justify-between font-mono text-[12px]">
          <span className="text-[var(--mute)]">
            {p.side} · {p.shares.toFixed(1)} shares
          </span>
          <span style={{ color: p.pnl >= 0 ? "var(--up)" : "var(--down)" }}>
            {p.pnl >= 0 ? "+" : "−"}
            {usd(Math.abs(p.pnl))}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-[var(--faint)]">
          <span>cost {usd(p.stake)}</span>
          <span>worth {usd(p.value)}</span>
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
          View · Add
        </button>
        <button
          type="button"
          onClick={onManage}
          className="min-h-[40px] flex-1 rounded-xl border border-[var(--line)] bg-[var(--btn)] text-[13px] font-semibold"
          style={{ color: claimable ? "var(--up)" : "var(--ink)" }}
        >
          {claimable ? "Claim winnings" : "Reduce · Close"}
        </button>
      </div>
    </li>
  );
}

/** The "Settled" tab: closed/resolved results from history, with won/lost
 *  filters and recent/biggest sorting. */
function SettledList({ onOpenMarket }: { onOpenMarket: (slug: string) => void }) {
  const state = useAuthed<{ history: HistoryRow[] }>("/webapp/v1/history");
  const [filter, setFilter] = useState<"all" | "won" | "lost">("all");
  const [sort, setSort] = useState<"date" | "pnl">("date");

  if (state.status === "loading")
    return <p className="py-12 text-center text-[var(--mute)]">Loading…</p>;
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
        {pill(filter === "all", "All", () => setFilter("all"))}
        {pill(filter === "won", "Won", () => setFilter("won"))}
        {pill(filter === "lost", "Lost", () => setFilter("lost"))}
      </div>
      <div className="mt-2 flex gap-2">
        {pill(sort === "date", "🕑 Recent", () => setSort("date"))}
        {pill(sort === "pnl", "💰 Biggest", () => setSort("pnl"))}
      </div>

      {rows.length === 0 ? (
        <p className="py-12 text-center text-[14px] text-[var(--mute)]">No settled bets match this filter.</p>
      ) : (
        <>
          <p className="mt-4 flex items-center justify-between font-mono text-[11px] text-[var(--faint)]">
            <span>{rows.length} settled</span>
            <span style={{ color: total >= 0 ? "var(--up)" : "var(--down)" }}>
              net {total >= 0 ? "+" : "−"}
              {usd(Math.abs(total))}
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
            className="shrink-0 font-mono text-[13px] font-semibold"
            style={{ color: r.pnl >= 0 ? "var(--up)" : "var(--down)" }}
          >
            {r.pnl >= 0 ? "+" : "−"}
            {usd(Math.abs(r.pnl))}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-[var(--faint)]">
          <span>
            {r.side} · staked {usd(r.stake)}
            {r.stake > 0 ? ` · ${r.pnlPct >= 0 ? "+" : ""}${r.pnlPct.toFixed(0)}%` : ""}
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
      setError(server ?? "Couldn't close that position. Nothing changed — try again shortly.");
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
        aria-label={claimable ? "Claim winnings" : "Close position"}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--handle)]" />
        <div className="mx-auto max-w-md">
          <h2 className="text-[18px] font-bold tracking-[-0.02em]">
            {claimable ? "Claim winnings" : "Reduce position"}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--mute)]">{position.title}</p>
          <p className="mt-0.5 font-mono text-[11px] text-[var(--faint)]">
            {position.side} · {position.shares.toFixed(1)} shares @ {cents(position.curPrice)}
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
                  {v === 100 ? "All" : `${v}%`}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between rounded-xl bg-[var(--btn)] px-4 py-3">
            <span className="text-[13px] text-[var(--mute)]">
              {claimable ? "Redeems for" : `Sell ${sellShares.toFixed(1)} shares ≈`}
            </span>
            <span className="font-mono text-[17px] font-bold" style={{ color: "var(--up)" }}>
              {usd(estProceeds)}
            </span>
          </div>

          {!claimable && (
            <p className="mt-2 font-mono text-[11px] text-[var(--faint)]">
              Estimate at the current price; the fill is quoted server-side and may differ.
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
            {submitting
              ? "Processing…"
              : claimable
                ? `Claim ${usd(estProceeds)}`
                : pct === 100
                  ? "Sell all"
                  : `Sell ${pct}%`}
          </button>
          <p className="mt-3 text-center font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
            SIGNED ON-CHAIN · NON-REVERSIBLE
          </p>
        </div>
      </div>
    </>
  );
}

export function WalletScreen() {
  const state = useAuthed<Account>("/webapp/v1/me");
  const [sheet, setSheet] = useState<"deposit" | "withdraw" | null>(null);
  const [sent, setSent] = useState<WithdrawSent | null>(null);

  if (state.status === "loading")
    return <p className="px-4 py-12 text-center text-[var(--mute)]">Loading…</p>;
  if (state.status === "failed") return <Failure kind={state.kind} />;

  const data = state.data;
  const addr = data.depositWalletAddress ?? data.walletAddress;

  return (
    <div className="px-4 pb-28">
      <h1 className="py-4 text-[20px] font-bold tracking-[-0.02em]">Wallet</h1>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
        <div className="font-mono text-[10px] tracking-[0.08em] text-[var(--faint)]">
          AVAILABLE BALANCE
        </div>
        <div className="mt-1 font-mono text-[30px] font-bold">{usd(data.balance)}</div>
        <p className="mt-1 text-[12px] text-[var(--mute)]">
          USDC on Polygon · self-custodial via Privy
        </p>

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
            Deposit
          </button>
          <button
            type="button"
            onClick={() => setSheet("withdraw")}
            disabled={data.balance <= 0}
            className="min-h-[48px] flex-1 rounded-xl border border-[var(--line)] bg-[var(--btn)] font-semibold text-[var(--ink)] disabled:opacity-40"
          >
            Withdraw
          </button>
        </div>
      </div>

      {(data.depositWalletAddress || data.walletAddress) && (
        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
          <div className="font-mono text-[10px] tracking-[0.08em] text-[var(--faint)]">
            YOUR ACCOUNTS
          </div>
          <div className="mt-3 flex flex-col gap-4">
            {data.depositWalletAddress && (
              <AddressRow
                label="🟣 POLYMARKET ACCOUNT · POLYGON"
                address={data.depositWalletAddress}
                sublabel="Deposit USDC on Polygon to this address. Polygon only — funds sent on another network can't be recovered."
                link={{
                  href: `https://polymarket.com/profile/${data.depositWalletAddress}`,
                  text: "View on Polymarket ↗",
                }}
              />
            )}
            {data.walletAddress && data.walletAddress !== data.depositWalletAddress && (
              <AddressRow
                label="🔑 PRIVY WALLET · SIGNER"
                address={data.walletAddress}
                tone="warn"
                sublabel="⚠️ Don't deposit here — this is your signing wallet. Add funds to the Polymarket address above (or use Deposit)."
              />
            )}
          </div>
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
            <div className="font-semibold">Sent {usd(sent.amountUsdc)}</div>
            <div className="mt-0.5 font-mono text-[10px] opacity-70">
              {sent.txHash ? `${sent.txHash.slice(0, 10)}…` : "Confirming on-chain"}
            </div>
            <button
              type="button"
              onClick={() => setSent(null)}
              className="mt-1 text-[11px] underline opacity-70"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Deposit: the address, a QR for phone-to-phone, and the network warning. */
function DepositSheet({ address, onClose }: { address: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

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
        aria-label="Deposit"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--handle)]" />
        <div className="mx-auto max-w-md text-center">
          <h2 className="text-[18px] font-bold tracking-[-0.02em]">Deposit USDC</h2>
          <p className="mt-1 text-[12px] text-[var(--mute)]">Polygon network only</p>

          {qr && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qr}
              alt={`QR code for deposit address ${address}`}
              width={180}
              height={180}
              className="mx-auto mt-4 h-[180px] w-[180px] rounded-xl bg-white p-2"
            />
          )}

          <code className="mt-4 block font-mono text-[12px] break-all">{address}</code>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(address);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
            className="mt-4 min-h-[48px] w-full rounded-2xl bg-[var(--ink)] font-semibold text-[var(--on-ink)]"
          >
            {copied ? "Copied" : "Copy address"}
          </button>

          <p className="mt-3 text-[11px] leading-relaxed text-[var(--faint)]">
            Send USDC on Polygon only. Anything sent on another network, or a
            different token, cannot be recovered. Funds appear here once the
            transfer confirms.
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
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <code className="mt-1 block font-mono text-[12px] break-all">{address}</code>
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
