"use client";

import { useEffect, useState } from "react";
import { usd } from "@/lib/format";
import { authedGet, ApiCallError, type ApiFailure } from "@/lib/client-api";
import { botLink, useTelegram } from "@/lib/telegram";
import { SignInButton } from "./SignInButton";

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

function useAuthed<T>(path: string): State<T> {
  const [state, setState] = useState<State<T>>({ status: "loading" });

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
  }, [path]);

  return state;
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

        {/* Deposit and withdraw stay in the bot for now: both are money flows
            with their own locks and confirmations, and duplicating them here
            would mean a second path to get wrong. */}
        <a
          href={botLink()}
          className="mt-4 flex min-h-[48px] items-center justify-center rounded-xl bg-[var(--ink)] font-semibold text-[var(--on-ink)]"
        >
          Deposit or withdraw in Telegram
        </a>
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
