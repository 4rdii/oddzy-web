"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLogin, usePrivy, useWallets, useSigners } from "@privy-io/react-auth";
import { authedPost } from "@/lib/client-api";
import { attribution } from "@/lib/track";
import { useLocale } from "./LocaleProvider";

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
/** Posts a diagnostic line to the bot server log (proxied on polybaaz.com). */
function report(stage: string, extra: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || !/(^|\.)polybaaz\.com$/.test(window.location.hostname)) return;
  fetch("/log/wallet-stuck", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ stage, origin: window.location.origin, ua: navigator.userAgent, platform: "web", ...extra }),
    keepalive: true,
  }).catch(() => {});
}

const PRIVY_READY_TIMEOUT_MS = 12_000;

/**
 * Privy's SDK has not reported ready. That is its own start-up (config fetch
 * and wallet iframe from privy.io), before any login: when it hangs the cause
 * is the network between the browser and Privy, not us. Spinning forever told
 * the user nothing; after a while say so, offer a reload, and log it.
 */
function NotReady({ compact }: { compact: boolean }) {
  const { t } = useLocale();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSlow(true);
      report("web-privy-not-ready", { elapsedMs: PRIVY_READY_TIMEOUT_MS });
    }, PRIVY_READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!slow) return <Centered compact={compact}>{t.app.login.loading}</Centered>;
  return (
    <Centered compact={compact}>
      <p className="text-[14px] leading-6 text-[var(--mute)]">{t.app.login.privySlow}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-4 min-h-[44px] rounded-xl bg-[var(--ink)] px-5 text-[14px] font-semibold text-[var(--on-ink)]"
      >
        {t.app.login.reload}
      </button>
    </Centered>
  );
}

/** `compact`: inside the website's trade modal rather than full-screen /app. */
export function WebLogin({ onReady, compact = false }: { onReady: () => void; compact?: boolean }) {
  const { t, tf } = useLocale();
  const { ready, authenticated, logout, user } = usePrivy();
  // Same modal as usePrivy().login, plus the failure reason. "Authentication
  // failed" in the modal says nothing; the code goes to the bot server's log
  // (/log/wallet-stuck is proxied on polybaaz.com) so a flaky login can be read.
  const { login } = useLogin({
    onError: (err) => report("web-login", { lastError: String(err) }),
  });
  const { wallets } = useWallets();
  const { addSigners, removeSigners } = useSigners();

  const [phase, setPhase] = useState<Phase>("login");
  const [error, setError] = useState<string | null>(null);
  // Setup is not idempotent-cheap (it provisions a deposit wallet), and React
  // may run this effect twice in dev. One attempt per mount.
  const started = useRef(false);

  // Only the ADDRESS crosses into the effect below. The wallet object gets a
  // new identity on every render, so depending on it re-runs the effect
  // continuously; a plain string compares by value and settles.
  const address = wallets.find((w) => w.walletClientType === "privy")?.address;
  // Derived, not stored — see the effect below.
  const shown: Phase = phase === "login" && authenticated && !address ? "wallet" : phase;

  const fail = useCallback((msg: string) => {
    setError(msg);
    setPhase("error");
  }, []);

  useEffect(() => {
    if (!ready || !authenticated) return;
    if (started.current) return;

    if (!address) {
      // No setPhase here: "waiting for the wallet" is derivable from the fact
      // that we're authenticated without one, and setting it synchronously in an
      // effect just triggers a second render to say what the first already knew.
      const timer = setTimeout(() => fail(t.app.login.walletTimeout), WALLET_READY_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }

    started.current = true;

    (async () => {
      try {
        setPhase("granting");
        // Revoke first, then grant — the same order the Telegram onboarding uses.
        // Granting on a wallet that already carries a signer is rejected with a
        // 400, which is exactly what a returning user hits.
        await removeSigners({ address }).catch(() => {
          // Nothing to revoke on a fresh wallet; that is the normal case.
        });
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
        // Where this account came from (shared-link source + anonymous visitor
        // id) so the signup joins to the page events that preceded it.
        await authedPost("/webapp/v1/register", attribution());

        setPhase("ready");
        onReady();
      } catch (e) {
        // Deliberately NOT clearing started.current. Doing so re-armed this
        // effect, and because `embedded` is a fresh object on every render the
        // effect re-ran immediately — an unbounded retry loop that hammered
        // Privy and locked the tab in a render storm. Retrying is the user's
        // call, via the button below, which clears the flag explicitly.
        const server = (e as { serverMessage?: string })?.serverMessage;
        const detail = e instanceof Error ? e.message : String(e);
        console.error("[WebLogin] setup failed:", e);
        fail(server ?? tf(t.app.login.setupFailed, { detail }));
      }
    })();
  }, [ready, authenticated, address, addSigners, removeSigners, onReady, fail, t, tf]);

  if (!ready) {
    return <NotReady compact={compact} />;
  }

  if (!authenticated) {
    return (
      <Centered compact={compact}>
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">{t.app.login.title}</h1>
        <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-[var(--mute)]">
          {t.app.login.lead}
        </p>
        <button
          type="button"
          onClick={login}
          className="mt-6 min-h-[52px] w-full max-w-xs rounded-2xl bg-[var(--ink)] text-[16px] font-bold text-[var(--on-ink)]"
        >
          {t.app.login.signIn}
        </button>
        <p className="mt-3 font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
          {t.app.login.methods}
        </p>
      </Centered>
    );
  }

  if (shown === "error") {
    return (
      <Centered compact={compact}>
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
          {t.app.login.tryAgain}
        </button>
        <button
          type="button"
          onClick={() => logout()}
          className="mt-2 min-h-[40px] text-[13px] text-[var(--mute)]"
        >
          {t.app.login.signOut}
        </button>
      </Centered>
    );
  }

  return (
    <Centered compact={compact}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]" />
      <p className="mt-4 text-[14px] text-[var(--mute)]">
        {shown === "wallet"
          ? t.app.login.creatingWallet
          : shown === "granting"
            ? t.app.login.authorizing
            : t.app.login.settingUp}
      </p>
      {user?.wallet?.address && (
        <p className="mt-2 font-mono text-[10px] tracking-[0.04em] text-[var(--faint)]">
          <span className="ltr-num">
            {user.wallet.address.slice(0, 6)}…{user.wallet.address.slice(-4)}
          </span>
        </p>
      )}
    </Centered>
  );
}

function Centered({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <div className={`flex ${compact ? "min-h-[300px]" : "min-h-[70vh]"} flex-col items-center justify-center px-6 text-center`}>
      {children}
    </div>
  );
}
