"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy, useWallets, useSigners } from "@privy-io/react-auth";
import { authedPost } from "@/lib/client-api";

const SIGNER_ID = process.env.NEXT_PUBLIC_PRIVY_SIGNER_ID ?? "";
const POLICY_ID = process.env.NEXT_PUBLIC_PRIVY_POLICY_ID ?? "";

/** How long to wait for the embedded wallet's key-management iframe to come up. */
const WALLET_READY_TIMEOUT_MS = 20_000;
/** How long to wait for the signer grant itself. */
const GRANT_TIMEOUT_MS = 30_000;

type Phase = "login" | "wallet" | "granting" | "registering" | "ready" | "error";

/**
 * Login + wallet setup for browser visitors.
 *
 * Mirrors the Telegram onboarding in apps/bot/web/miniapp.tsx, and deliberately
 * so — both must end with the SAME thing: an embedded Privy wallet whose signing
 * has been granted to our server key. That grant is what lets the backend place
 * orders without a signature prompt per bet.
 *
 * A user who logs in with MetaMask or Trust gets that external wallet linked to
 * their Privy account, but it is never the signer and never the funder: its key
 * is on their device, so it cannot be granted to us. They trade from the
 * embedded wallet like everyone else and fund it from MetaMask with a normal
 * USDC transfer.
 *
 * The wallet-ready wait is not paranoia. Signing against an address before its
 * proxy iframe is up throws "wallet proxy not initialized" — the same failure
 * that makes Privy unusable inside Telegram Desktop's WebKitGTK view. A timeout
 * gives a readable message instead of a spinner that never resolves.
 */
export function WebLogin({ onReady }: { onReady: () => void }) {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const { addSigners } = useSigners();

  const [phase, setPhase] = useState<Phase>("login");
  const [error, setError] = useState<string | null>(null);
  // Setup is not idempotent-cheap (it provisions a deposit wallet), and React
  // may run this effect twice in dev. One attempt per mount.
  const started = useRef(false);

  const embedded = wallets.find((w) => w.walletClientType === "privy");
  // Derived, not stored — see the effect below.
  const shown: Phase = phase === "login" && authenticated && !embedded ? "wallet" : phase;

  const fail = useCallback((msg: string) => {
    setError(msg);
    setPhase("error");
  }, []);

  useEffect(() => {
    if (!ready || !authenticated) return;
    if (started.current) return;

    if (!embedded) {
      // No setPhase here: "waiting for the wallet" is derivable from the fact
      // that we're authenticated without one, and setting it synchronously in an
      // effect just triggers a second render to say what the first already knew.
      const t = setTimeout(
        () =>
          fail(
            "Your wallet didn't finish loading. This is usually a desktop browser " +
              "issue — try again on mobile or in Chrome.",
          ),
        WALLET_READY_TIMEOUT_MS,
      );
      return () => clearTimeout(t);
    }

    started.current = true;
    const address = embedded.address;

    (async () => {
      try {
        setPhase("granting");
        await Promise.race([
          addSigners({
            address,
            signers: [{ signerId: SIGNER_ID, policyIds: POLICY_ID ? [POLICY_ID] : [] }],
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timed out")), GRANT_TIMEOUT_MS),
          ),
        ]);

        setPhase("registering");
        // Creates the account row and provisions the deposit wallet. Safe to
        // repeat: the server returns the existing account rather than a second one.
        await authedPost("/webapp/v1/register", {});

        setPhase("ready");
        onReady();
      } catch (e) {
        started.current = false;
        const server = (e as { serverMessage?: string })?.serverMessage;
        fail(server ?? "Couldn't finish setting up your wallet. Try again.");
      }
    })();
  }, [ready, authenticated, embedded, addSigners, onReady, fail]);

  if (!ready) {
    return <Centered>Loading…</Centered>;
  }

  if (!authenticated) {
    return (
      <Centered>
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">Trade prediction markets</h1>
        <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-[var(--mute)]">
          Sign in to place bets. Your wallet is yours — we never hold your funds.
        </p>
        <button
          type="button"
          onClick={login}
          className="mt-6 min-h-[52px] w-full max-w-xs rounded-2xl bg-[var(--ink)] text-[16px] font-bold text-[var(--on-ink)]"
        >
          Sign in
        </button>
        <p className="mt-3 font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
          TELEGRAM · GOOGLE · WALLET
        </p>
      </Centered>
    );
  }

  if (shown === "error") {
    return (
      <Centered>
        <p className="max-w-xs text-[14px] leading-relaxed text-[var(--down)]">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setPhase("login");
            started.current = false;
          }}
          className="mt-5 min-h-[46px] w-full max-w-xs rounded-2xl bg-[var(--ink)] text-[15px] font-bold text-[var(--on-ink)]"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => logout()}
          className="mt-2 min-h-[40px] text-[13px] text-[var(--mute)]"
        >
          Sign out
        </button>
      </Centered>
    );
  }

  return (
    <Centered>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]" />
      <p className="mt-4 text-[14px] text-[var(--mute)]">
        {shown === "wallet"
          ? "Creating your wallet…"
          : shown === "granting"
            ? "Authorizing trading…"
            : "Setting up your account…"}
      </p>
      {user?.wallet?.address && (
        <p className="mt-2 font-mono text-[10px] tracking-[0.04em] text-[var(--faint)]">
          {user.wallet.address.slice(0, 6)}…{user.wallet.address.slice(-4)}
        </p>
      )}
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}
