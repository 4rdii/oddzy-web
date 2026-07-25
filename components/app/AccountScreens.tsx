"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { usd } from "@/lib/format";
import { authedGet, ApiCallError, type ApiFailure } from "@/lib/client-api";
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

export function PositionsScreen() {
  const [tab, setTab] = useState<"open" | "settled">("open");
  const state = useAuthed<{ positions: Position[] }>("/webapp/v1/positions");

  if (state.status === "loading")
    return <p className="px-4 py-12 text-center text-[var(--mute)]">Loading…</p>;
  if (state.status === "failed") return <Failure kind={state.kind} />;

  const all = state.data.positions;
  const shown = all.filter((p) => p.settled === (tab === "settled"));
  const open = all.filter((p) => !p.settled);
  const openValue = open.reduce((a, p) => a + p.value, 0);
  const unrealized = open.reduce((a, p) => a + p.pnl, 0);

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

      {shown.length === 0 ? (
        <p className="py-12 text-center text-[14px] text-[var(--mute)]">
          No {tab} positions yet.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {shown.map((p) => (
            <li
              key={`${p.marketId}-${p.side}`}
              className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4"
            >
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WalletScreen() {
  const state = useAuthed<Account>("/webapp/v1/me");
  const [copied, setCopied] = useState(false);
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

      {addr && (
        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
          <div className="font-mono text-[10px] tracking-[0.08em] text-[var(--faint)]">
            DEPOSIT ADDRESS · POLYGON
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <code className="font-mono text-[12px] break-all">{addr}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(addr);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}
              className="min-h-[36px] shrink-0 rounded-lg border border-[var(--line)] bg-[var(--btn)] px-3 font-mono text-[11px] text-[var(--mute)]"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--faint)]">
            Send USDC on Polygon only. Funds sent on another network can&apos;t be recovered.
          </p>
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
