"use client";

import { usePrivy } from "@privy-io/react-auth";
import { PRIVY_ENABLED } from "./PrivyRoot";
import { botLink } from "@/lib/telegram";
import { useLocale } from "./LocaleProvider";

/**
 * Sign in / sign out for web visitors.
 *
 * Web login replaced "Open in Telegram" as the primary call to action: sending
 * someone to the bot used to be the only way they could trade, and now it isn't.
 * The Telegram link survives only as the fallback for when Privy is unavailable,
 * because that is the one case where the bot really is the only route in.
 *
 * Split in two so the hook is never called conditionally: without an app id
 * there is no provider above us and usePrivy would throw. PRIVY_ENABLED is a
 * module constant, so which branch renders is fixed for the life of the page.
 */
export function SignInButton({ className }: { className: string }) {
  const { t } = useLocale();
  if (!PRIVY_ENABLED) {
    return (
      <a href={botLink()} className={className}>
        {t.app.login.openTelegram}
      </a>
    );
  }
  return <PrivySignIn className={className} />;
}

function PrivySignIn({ className }: { className: string }) {
  const { t } = useLocale();
  const { ready, authenticated, login, logout } = usePrivy();

  // Render nothing rather than a "Sign in" that flips to "Sign out" a moment
  // later — a returning user would see their own state misreported.
  if (!ready) return null;

  return (
    <button
      type="button"
      onClick={authenticated ? () => logout() : login}
      className={className}
    >
      {authenticated ? t.app.login.signOut : t.app.login.signIn}
    </button>
  );
}
