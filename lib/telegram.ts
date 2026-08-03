"use client";

import { useEffect, useState } from "react";

/**
 * Telegram Mini App detection + SDK access.
 *
 * The whole "one codebase, two modes" design rests on this: inside Telegram the
 * app renders the trading surface; in a normal browser it renders the marketing
 * site and blog. Googlebot has no window.Telegram, so crawlers always get
 * marketing mode — no separate rendering path for bots.
 *
 * IMPORTANT: detection is client-only. Server-rendered output must be the WEB
 * variant, always, or the crawlable HTML would depend on a runtime check that
 * never runs server-side. Components branch after mount.
 */

export type TelegramWebApp = {
  initData: string;
  initDataUnsafe?: { user?: { id: number; first_name?: string; username?: string } };
  colorScheme?: "light" | "dark";
  platform?: string;
  version?: string;
  ready: () => void;
  expand: () => void;
  close: () => void;
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
  };
  BackButton?: { show: () => void; hide: () => void; onClick: (cb: () => void) => void };
  MainButton?: unknown;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

/**
 * True only when we're genuinely running inside a Telegram client.
 *
 * The SDK script defines window.Telegram.WebApp even in a plain browser, so its
 * mere presence proves nothing — a desktop visitor who loads the script would
 * be misread as a Telegram user. Non-empty initData is the real signal.
 *
 * Known wrinkle: some cloned Telegram clients (notably ones common in Iran)
 * send an EMPTY initData, so they will be treated as web visitors here. That is
 * the safe direction to fail — they get the browsable site rather than a
 * trading surface that would 401 on every authenticated call.
 */
export function isTelegram(): boolean {
  const wa = getWebApp();
  return !!wa && typeof wa.initData === "string" && wa.initData.length > 0;
}

export type TelegramState = {
  /** null until mount — server render and first paint must not branch on it. */
  inTelegram: boolean | null;
  webApp: TelegramWebApp | null;
  initData: string;
};

/**
 * Resolves after mount. `inTelegram === null` means "not decided yet"; render
 * the web variant (or a neutral shell) until it settles.
 */
export function useTelegram(): TelegramState {
  const [state, setState] = useState<TelegramState>({
    inTelegram: null,
    webApp: null,
    initData: "",
  });

  useEffect(() => {
    const wa = getWebApp();
    const inTg = !!wa && typeof wa.initData === "string" && wa.initData.length > 0;
    if (wa && inTg) {
      wa.ready();
      wa.expand();
    }
    setState({ inTelegram: inTg, webApp: wa, initData: wa?.initData ?? "" });
  }, []);

  return state;
}

/**
 * Deep link into the bot for web visitors who need to finish in Telegram.
 *
 * `bot` should come from `brandFor(locale).tgBot` — each brand has its own bot
 * (@poly_sport_bet_bot for Oddzy, @PolyBaaz_Bot for PolyBaaz), and sending a
 * Persian visitor to the English bot would drop them into the wrong locale with
 * no way back. The env default is kept only for callers that predate the second
 * brand.
 */
export function botLink(startParam?: string, bot?: string): string {
  bot ??= process.env.NEXT_PUBLIC_TG_BOT ?? "poly_sport_bet_bot";
  return startParam
    ? `https://t.me/${bot}?start=${encodeURIComponent(startParam)}`
    : `https://t.me/${bot}`;
}
