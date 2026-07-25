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

export function PrivyRoot({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // Without an app id the provider throws on mount and takes the whole route
  // down. Rendering the children unwrapped degrades to browse-only, which is
  // the right failure: the market feed is server-rendered and still works.
  if (!appId) return <>{children}</>;

  return (
    <PrivyProvider
      appId={appId}
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
