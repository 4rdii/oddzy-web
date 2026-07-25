"use client";

import { getWebApp } from "./telegram";

/**
 * Browser-side client for the bot server's authenticated API.
 *
 * Calls go straight to app.oddzy.xyz rather than hopping through a Next route
 * handler: it's one less network leg, and the bot already allow-lists our
 * origins for CORS. The market feed is the opposite case — that one proxies
 * through Next because it needs a bearer token that must stay server-side.
 *
 * Auth is the Telegram Mini App initData, which is only present inside
 * Telegram. Outside it every call fails `unauthorized` by design until the
 * Privy web-login milestone lands.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://app.oddzy.xyz";

export type ApiFailure =
  /** No initData — a plain browser visitor, or a cloned Telegram client. */
  | "unauthenticated"
  /** Valid Telegram user with no wallet yet — send them to onboarding. */
  | "no_account"
  | "blocked"
  | "rate_limited"
  | "unavailable";

export class ApiCallError extends Error {
  constructor(readonly kind: ApiFailure) {
    super(kind);
    this.name = "ApiCallError";
  }
}

export async function authedGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const initData = getWebApp()?.initData ?? "";
  if (!initData) throw new ApiCallError("unauthenticated");

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      signal,
      headers: { "X-Telegram-Init-Data": initData },
    });
  } catch (e) {
    // Preserve aborts so callers can distinguish an unmount from a failure.
    if ((e as Error)?.name === "AbortError") throw e;
    throw new ApiCallError("unavailable");
  }

  if (res.ok) return (await res.json()) as T;

  if (res.status === 401) throw new ApiCallError("unauthenticated");
  if (res.status === 404) throw new ApiCallError("no_account");
  if (res.status === 403) throw new ApiCallError("blocked");
  if (res.status === 429) throw new ApiCallError("rate_limited");
  throw new ApiCallError("unavailable");
}
