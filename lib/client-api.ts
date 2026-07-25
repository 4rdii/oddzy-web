"use client";

import { getAccessToken } from "@privy-io/react-auth";
import { getWebApp } from "./telegram";

/**
 * Browser-side client for the bot server's authenticated API.
 *
 * Calls go straight to app.oddzy.xyz rather than hopping through a Next route
 * handler: it's one less network leg, and the bot already allow-lists our
 * origins for CORS. The market feed is the opposite case — that one proxies
 * through Next because it needs a bearer token that must stay server-side.
 *
 * Two credentials, matching the server's `authenticate`:
 *   - Telegram Mini App initData, when running inside Telegram.
 *   - A Privy access token, for browsers on oddzy.xyz.
 *
 * initData is preferred when present, mirroring the server's precedence, so the
 * two never disagree about who the caller is.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://app.oddzy.xyz";

/**
 * Build the auth header for a request, or throw if the caller has neither
 * credential.
 *
 * getAccessToken() is the standalone form rather than the hook, so this stays
 * callable from plain functions. It refreshes the token when near expiry, which
 * is why it is called per-request instead of being cached.
 */
async function authHeaders(): Promise<Record<string, string>> {
  const initData = getWebApp()?.initData ?? "";
  if (initData) return { "X-Telegram-Init-Data": initData };

  const token = await getAccessToken().catch(() => null);
  if (token) return { Authorization: `Bearer ${token}` };

  throw new ApiCallError("unauthenticated");
}

export type ApiFailure =
  /** Neither credential: a logged-out visitor, or a cloned Telegram client. */
  | "unauthenticated"
  /** Authenticated but no wallet yet — send them to onboarding, not to login. */
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

/** POST with the same auth + error mapping as authedGet. */
export async function authedPost<T>(path: string, body: unknown): Promise<T> {
  const auth = await authHeaders();

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiCallError("unavailable");
  }

  const data = await res.json().catch(() => ({}));
  if (res.ok) return data as T;

  // Placement failures carry a user-facing message from the server; surface it
  // rather than a generic string, because "the price moved, nothing was
  // placed" and "finish wallet setup" need very different reactions.
  const err = new ApiCallError(
    res.status === 401 ? "unauthenticated"
    : res.status === 403 ? "blocked"
    : res.status === 404 ? "no_account"
    : res.status === 429 ? "rate_limited"
    : "unavailable",
  );
  (err as ApiCallError & { serverMessage?: string }).serverMessage =
    typeof data?.message === "string" ? data.message : undefined;
  throw err;
}

export async function authedGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const auth = await authHeaders();

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { signal, headers: auth });
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
