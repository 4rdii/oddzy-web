"use client";

import { PrivyProvider } from "@privy-io/react-auth";

/**
 * Privy provider for the trading surface.
 *
 * Wraps /app only. The marketing pages and the blog must stay free of it: they
 * are the crawlable, cacheable part of the site and have no business loading an
 * auth SDK.
 *
 * `createOnLogin: "all-users"` is deliberate and load-bearing. The alternative,
 * "users-without-wallets", skips creation when the user already has ANY wallet
 * linked — which is precisely what happens when someone logs in with MetaMask or
 * Trust. Those users would end up with an external wallet and no embedded one,
 * nothing to delegate, and therefore no way to trade. Every login method must
 * produce an embedded wallet, because that is the only wallet the server can
 * sign with.
 */
/**
 * Whether web login is available at all. Anything that calls a Privy hook must
 * check this first — without an app id there is no provider above it, and the
 * hook would throw.
 */
export const PRIVY_ENABLED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

/**
 * Privy app client per brand. Same app (same users and wallets); the "persian
 * bot" client logs in with @PolyBaaz_Bot, so Telegram login on polybaaz.com
 * goes through the PolyBaaz bot rather than the Oddzy one, whose BotFather
 * domain cannot also be polybaaz.com. Client ids are public. The bot's own
 * mini app uses the same one (PRIVY_CLIENT_ID_FA).
 */
const FA_CLIENT_ID =
  process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID_FA ?? "client-WY6ZbEtz28WbnxYxWm2QBU4BSvkMG8hjzjG6NbYPoCu1D";

function clientIdForHost(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return /(^|\.)polybaaz\.com$/.test(window.location.hostname) ? FA_CLIENT_ID : undefined;
}

export function PrivyRoot({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const clientId = clientIdForHost();

  // Without an app id the provider throws on mount and takes the whole route
  // down. Rendering the children unwrapped degrades to browse-only, which is
  // the right failure: the market feed is server-rendered and still works.
  if (!appId) return <>{children}</>;

  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId}
      config={{
        loginMethods: ["telegram", "google", "wallet"],
        embeddedWallets: { ethereum: { createOnLogin: "all-users" } },
        // No `logo`: there is no icon asset in public/, and pointing at a
        // missing file only bought a 404 in the login modal.
        appearance: { theme: "dark", accentColor: "#2d5bff" },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
