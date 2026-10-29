"use client";

/**
 * Trading on the website itself (desktop), without loading the auth SDK on
 * every page.
 *
 * The public pages stay plain cacheable HTML. Anything that wants to trade —
 * a Trade button, the header's Sign in / balance — sends a message here; the
 * TradeHost mounted in the layout lazy-loads the trading runtime (Privy + the
 * trade modal) on the first message, or quietly in the background when the
 * browser already holds a Privy session, so a returning user sees their
 * balance in the header.
 *
 * Every entry point keeps its /app link as the fallback: without JS, on a
 * page where the host is off (/app, baskets, creator pages carry their own
 * provider), or on a modified click, the link just navigates.
 */

export type TradeSide = "YES" | "NO";
/**
 * `title` / `label`: what the page shows for this market and the requested
 * side (e.g. a Persian question and «برد اسپانیا»). The trade API returns the
 * English title only, so the page's own wording wins when it has one.
 */
export type TradeRequest = { slug: string; side?: TradeSide; amount?: number; title?: string; label?: string };
export type TradeMsg = { kind: "trade"; req: TradeRequest } | { kind: "signin" } | { kind: "account" };

const EV = "oz-trade";

/** Set by TradeHost while mounted; entry points fall back to their link without it. */
export function hostActive(): boolean {
  return typeof window !== "undefined" && (window as unknown as { __ozTradeHost?: boolean }).__ozTradeHost === true;
}

export function sendTrade(msg: TradeMsg): boolean {
  if (!hostActive()) return false;
  window.dispatchEvent(new CustomEvent<TradeMsg>(EV, { detail: msg }));
  return true;
}

export function onTradeMsg(cb: (m: TradeMsg) => void): () => void {
  const f = (e: Event) => cb((e as CustomEvent<TradeMsg>).detail);
  window.addEventListener(EV, f);
  return () => window.removeEventListener(EV, f);
}

/**
 * Click handler for a link that should open the trade modal instead of /app.
 * Plain left clicks only — a ctrl/cmd/middle click still opens /app in a new
 * tab, as the link promises.
 */
export function tradeClick(e: { preventDefault: () => void; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; button?: number }, msg: TradeMsg): void {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e.button ?? 0) !== 0) return;
  if (sendTrade(msg)) e.preventDefault();
}

/** Whether this browser holds a Privy session (its tokens live in localStorage). No SDK needed. */
export function hasSessionHint(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? "";
      if (k.startsWith("privy:") && k.includes("token")) return true;
    }
  } catch {
    // storage blocked
  }
  return false;
}

/**
 * The signed-in account as the header shows it. "unknown" until the runtime
 * has looked; "out" when signed out (or setup unfinished).
 */
export type Me = { state: "unknown" } | { state: "out" } | { state: "in"; balance: number | null };

let me: Me = { state: "unknown" };
const meListeners = new Set<() => void>();

export function getMe(): Me {
  return me;
}
export function setMe(next: Me): void {
  me = next;
  meListeners.forEach((f) => f());
}
export function subscribeMe(f: () => void): () => void {
  meListeners.add(f);
  return () => meListeners.delete(f);
}
const SERVER_ME: Me = { state: "unknown" };
export const getServerMe = (): Me => SERVER_ME;

