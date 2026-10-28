"use client";

/**
 * Anonymous attribution for the web app.
 *
 * Two pieces of state, both first-party and both best-effort:
 *
 *  - a VISITOR ID cookie, minted on first sight and kept a year, so the page
 *    events a person generates before they have an account can be joined to
 *    the account they create later (the register call sends it along);
 *  - the SOURCE of the current visit — the `?src=` on a shared link, e.g.
 *    "ig_0903" on a basket posted to Instagram — remembered in localStorage
 *    so it survives the hop from the basket page to /app and through login.
 *
 * Events go to the bot's /webapp/v1/event through the same-origin proxy and
 * are written to audit_log as `web:<visitorId>`. `sendBeacon` is used so a
 * CTA tap that navigates away (to t.me) still gets recorded; the fetch
 * fallback covers browsers that lack it.
 *
 * None of this ever throws: cookies and storage can be blocked (private
 * windows, some in-app browsers), and a page must render exactly the same
 * whether or not the visit is trackable.
 */

const VID_COOKIE = "oz_vid";
const SRC_KEY = "oz_src";
const SRC_TTL_MS = 7 * 24 * 3600 * 1000;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

/** Same charset the server accepts; anything else is dropped client-side too. */
const SRC_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;

function readCookie(name: string): string | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function uuid(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    // fall through
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** The visitor id, minting one on first call. Null only when cookies are unusable. */
export function getVisitorId(): string | null {
  if (typeof document === "undefined") return null;
  const existing = readCookie(VID_COOKIE);
  if (existing && /^[0-9a-f-]{8,40}$/.test(existing)) return existing;
  const id = uuid();
  try {
    document.cookie = `${VID_COOKIE}=${id}; Max-Age=${365 * 24 * 3600}; Path=/; SameSite=Lax; Secure`;
  } catch {
    return null;
  }
  return readCookie(VID_COOKIE) === id ? id : null;
}

/**
 * Read `?src=` from the current URL and remember it. Returns the source in
 * effect for this visit: the URL's if present, else a recent remembered one.
 */
export function captureSource(): string | null {
  if (typeof window === "undefined") return null;
  let fromUrl: string | null = null;
  try {
    const raw = new URLSearchParams(window.location.search).get("src");
    if (raw) {
      const s = raw.toLowerCase();
      if (SRC_RE.test(s)) fromUrl = s;
    }
  } catch {
    // ignore
  }
  if (fromUrl) {
    try {
      localStorage.setItem(SRC_KEY, JSON.stringify({ src: fromUrl, at: Date.now() }));
    } catch {
      // ignore
    }
    return fromUrl;
  }
  return getSource();
}

/** The remembered source for this visitor, if it is still fresh. */
export function getSource(): string | null {
  try {
    const raw = localStorage.getItem(SRC_KEY);
    if (!raw) return null;
    const { src, at } = JSON.parse(raw) as { src?: string; at?: number };
    if (typeof src !== "string" || !SRC_RE.test(src)) return null;
    if (typeof at !== "number" || Date.now() - at > SRC_TTL_MS) return null;
    return src;
  } catch {
    return null;
  }
}

const REF_KEY = "oz_ref";
const REF_TTL_MS = 30 * 24 * 3600 * 1000;
/** A referrer's account id. Negative ids are web-only accounts. */
const REF_RE = /^-?\d{1,19}$/;

/**
 * Read `?ref=` (a web invite link from the wallet page's Invite & Earn card)
 * and remember it for 30 days, so it survives browsing and a later login. The
 * register call sends it; the server applies it once, only on account creation.
 */
export function captureRef(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = new URLSearchParams(window.location.search).get("ref");
    if (raw && REF_RE.test(raw)) {
      localStorage.setItem(REF_KEY, JSON.stringify({ ref: raw, at: Date.now() }));
      return raw;
    }
  } catch {
    // ignore
  }
  return getRef();
}

function getRef(): string | null {
  try {
    const raw = localStorage.getItem(REF_KEY);
    if (!raw) return null;
    const { ref, at } = JSON.parse(raw) as { ref?: string; at?: number };
    if (typeof ref !== "string" || !REF_RE.test(ref)) return null;
    if (typeof at !== "number" || Date.now() - at > REF_TTL_MS) return null;
    return ref;
  } catch {
    return null;
  }
}

const FIRST_KEY = "oz_first";

/** Where this visitor first arrived from, stored on their first page view. */
export type FirstTouch = { site: string; landing: string; refHost: string | null; src: string | null; at: number };

/**
 * Record the visitor's FIRST touch: which of our sites, which page, the
 * external referrer and any ?src= campaign code. Called on every page load
 * (components/site/FirstTouch) but written only once per browser, so a
 * Google visitor who reads three pages and then signs up on /app is still
 * attributed to Google — before this, only basket pages and /app captured
 * anything, and 62 of 99 web sign-ups had no source (2026-10-28).
 */
export function captureFirstTouch(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(FIRST_KEY)) return;
    let refHost: string | null = null;
    try {
      const r = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
      // Our own sites are navigation, not a source.
      // Login screens are not where anyone came from: returning from "Sign in
      // with Google" shows accounts.google.com as the referrer.
      const auth = /^(accounts\.google\.com|auth\.privy\.io|appleid\.apple\.com|oauth\.telegram\.org)$/.test(r);
      if (r && !auth && r !== location.hostname.replace(/^www\./, "") && !/(^|\.)(oddzy\.xyz|polybaaz\.com)$/.test(r)) refHost = r.slice(0, 80);
    } catch {
      // ignore
    }
    const raw = new URLSearchParams(location.search).get("src");
    const src = raw && SRC_RE.test(raw.toLowerCase()) ? raw.toLowerCase() : null;
    const first: FirstTouch = { site: location.hostname.replace(/^www\./, ""), landing: location.pathname.slice(0, 120), refHost, src, at: Date.now() };
    localStorage.setItem(FIRST_KEY, JSON.stringify(first));
  } catch {
    // storage blocked: nothing to remember
  }
}

function getFirstTouch(): FirstTouch | null {
  try {
    const raw = localStorage.getItem(FIRST_KEY);
    return raw ? (JSON.parse(raw) as FirstTouch) : null;
  } catch {
    return null;
  }
}

/** The fields the server joins on; spread into any authenticated POST body. */
export function attribution(): {
  src: string | null;
  visitorId: string | null;
  ref: string | null;
  /** The site this request comes from: decides the account's brand (fa/en). */
  site: string | null;
  first: FirstTouch | null;
  device: "desktop" | "mobile" | null;
} {
  return {
    device: typeof window !== "undefined" ? deviceKind() : null,
    src: getSource(),
    visitorId: getVisitorId(),
    ref: getRef(),
    site: typeof location !== "undefined" ? location.hostname.replace(/^www\./, "") : null,
    first: getFirstTouch(),
  };
}

export type WebEvent = "basket_view" | "basket_cta" | "app_open" | "login_start" | "trade_open" | "trade_placed";

/** Desktop or phone, for the ops split: a fine pointer on a wide screen counts as desktop. */
export function deviceKind(): "desktop" | "mobile" | null {
  try {
    return window.matchMedia("(pointer: fine) and (min-width: 900px)").matches ? "desktop" : "mobile";
  } catch {
    return null;
  }
}

/** Fire-and-forget. Never throws, never awaited by callers. */
export function track(
  event: WebEvent,
  props: { basket?: string | null; target?: "tg" | "web"; src?: string | null } = {},
): void {
  const visitorId = getVisitorId();
  if (!visitorId) return;
  const body = JSON.stringify({
    event,
    visitorId,
    src: props.src ?? getSource(),
    basket: props.basket ?? null,
    target: props.target ?? null,
    ref: typeof document !== "undefined" ? document.referrer.slice(0, 200) : null,
    device: deviceKind(),
  });
  const url = `${API_BASE}/webapp/v1/event`;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const ok = navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      if (ok) return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}
