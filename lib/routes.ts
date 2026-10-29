/**
 * Routes whose bundle carries the Privy SDK (/app, baskets, creator pages).
 * Links to them must not prefetch: a visible "Baskets" menu item alone made
 * every Oddzy page download ~340 KB of auth code nobody had asked for.
 * Plain module (no "use client"): server components call it too.
 */
export function heavyRoute(href: string): boolean {
  return /^\/(app|baskets|creator)(\/|\?|$)/.test(href);
}
