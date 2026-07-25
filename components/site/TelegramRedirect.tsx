"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isTelegram } from "@/lib/telegram";

/**
 * Sends Telegram users from a marketing page straight into the app.
 *
 * Runs client-side only, after mount, so the server-rendered HTML a crawler
 * receives is always the marketing page. Googlebot has no window.Telegram, so
 * this never fires for it — which is exactly why the SEO story holds without a
 * separate rendering path for bots.
 */
export function TelegramRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (isTelegram()) router.replace("/app");
  }, [router]);

  return null;
}
