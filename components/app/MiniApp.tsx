"use client";

import { useCallback, useEffect, useState } from "react";
import Script from "next/script";
import type { Market } from "@/lib/api";
import type { Topic } from "@/lib/taxonomy";
import { useTelegram, botLink } from "@/lib/telegram";
import { authedGet } from "@/lib/client-api";
import { MarketsFeed } from "./MarketsFeed";
import { BrowseScreen } from "./BrowseScreen";
import { ThemeToggle } from "../site/ThemeToggle";
import { MarketDetail, type PlacedBet } from "./MarketDetail";
import { Receipt } from "./Receipt";
import { PositionsScreen, WalletScreen } from "./AccountScreens";
import { WebLogin } from "./WebLogin";
import { PRIVY_ENABLED } from "./PrivyRoot";

type Screen =
  | { name: "feed" }
  | { name: "browse" }
  | { name: "detail"; market: Market }
  | { name: "done"; bet: PlacedBet }
  | { name: "positions" }
  | { name: "wallet" };

/**
 * The trading surface.
 *
 * Rendered at /app for everyone — inside Telegram it's the Mini App, in a
 * browser it's the same screens with a "continue in Telegram" affordance where
 * an authenticated action is required. The marketing site and blog live on the
 * other routes and are never rendered here, which is what keeps the blog a
 * web-only surface.
 */
export function MiniApp({
  topics,
  initialMarkets,
}: {
  topics: Topic[];
  initialMarkets: Market[];
}) {
  const [screen, setScreen] = useState<Screen>({ name: "feed" });
  // The category picked in Browse; the feed reads it. Kept here so switching
  // tabs doesn't lose the filter.
  const [topic, setTopic] = useState<Topic | null>(null);
  const { inTelegram } = useTelegram();

  // null means "unknown", which renders the slip without a balance line rather
  // than claiming a fake $0 and blocking the stake as insufficient.
  const [balance, setBalance] = useState<number | null>(null);

  // Web visitors only. "unknown" until /me answers, so we never flash a login
  // screen at someone who is already signed in.
  const [webAuth, setWebAuth] = useState<"unknown" | "ok" | "needed">("unknown");

  const loadMe = useCallback(() => {
    const ctrl = new AbortController();
    authedGet<{ balance: number }>("/webapp/v1/me", ctrl.signal)
      .then((d) => {
        setBalance(d.balance);
        setWebAuth("ok");
      })
      .catch((e: unknown) => {
        // Inside Telegram a failure is not an auth problem — initData is always
        // present, so this is a network blip or an incomplete onboarding, and
        // the existing "open the bot" affordances already cover it. Balance is
        // an affordance, not a gate; the server re-checks funds either way.
        if ((e as Error)?.name === "AbortError") return;
        if (!inTelegram) setWebAuth("needed");
      });
    return () => ctrl.abort();
  }, [inTelegram]);

  useEffect(() => {
    if (inTelegram === null) return;
    return loadMe();
  }, [inTelegram, loadMe]);

  // Screens that can't render anything meaningful without an account.
  const gated =
    screen.name === "detail" || screen.name === "positions" || screen.name === "wallet";
  const needsLogin = inTelegram === false && PRIVY_ENABLED && webAuth === "needed";

  const tab =
    screen.name === "positions"
      ? "positions"
      : screen.name === "wallet"
        ? "wallet"
        : screen.name === "browse"
          ? "browse"
          : "markets";

  return (
    <>
      {/* Telegram's SDK. beforeInteractive so window.Telegram exists before our
          detection runs and we don't flash the web variant inside the app. */}
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />

      <div className="mx-auto min-h-screen max-w-md bg-[var(--page)] pb-16">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--page)_90%,transparent)] px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--ink)] text-[13px] font-bold text-[var(--on-ink)]">
              O
            </div>
            <span className="text-[15px] font-bold tracking-[-0.02em]">Oddzy</span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {inTelegram === false && (
            <a
              href={botLink()}
              className="min-h-[36px] rounded-lg bg-[var(--ink)] px-3 py-2 text-[12px] font-semibold text-[var(--on-ink)]"
            >
              Open in Telegram
            </a>
            )}
          </div>
        </header>

        {screen.name === "feed" && (
          <MarketsFeed
            topic={topic}
            initialMarkets={initialMarkets}
            onOpen={(m) => setScreen({ name: "detail", market: m })}
            onClearTopic={() => setTopic(null)}
            onBrowse={() => setScreen({ name: "browse" })}
          />
        )}

        {screen.name === "browse" && (
          <BrowseScreen
            topics={topics}
            onPick={(t) => {
              setTopic(t);
              setScreen({ name: "feed" });
            }}
          />
        )}

        {/* Browsing and search stay open to everyone — that's the whole point of
            a crawlable market feed. Only the screens that need an account are
            gated, and only for web visitors: inside Telegram initData already
            answers for them. */}
        {gated && needsLogin ? (
          <WebLogin
            onReady={() => {
              setWebAuth("ok");
              loadMe();
            }}
          />
        ) : (
          <>
            {screen.name === "detail" && (
              <MarketDetail
                market={screen.market}
                balance={balance}
                onBack={() => setScreen({ name: "feed" })}
                onPlaced={(bet) => setScreen({ name: "done", bet })}
              />
            )}

        {screen.name === "done" && (
          <Receipt
            bet={screen.bet}
            onPositions={() => setScreen({ name: "positions" })}
            onNext={() => setScreen({ name: "feed" })}
          />
        )}

            {screen.name === "positions" && <PositionsScreen />}
            {screen.name === "wallet" && <WalletScreen />}
          </>
        )}

        <nav
          className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md border-t border-[var(--line)] bg-[var(--paper)]"
          aria-label="Main"
        >
          <TabButton
            active={tab === "markets"}
            icon="◈"
            label="Markets"
            onClick={() => setScreen({ name: "feed" })}
          />
          <TabButton
            active={tab === "browse"}
            icon="☰"
            label="Browse"
            onClick={() => setScreen({ name: "browse" })}
          />
          <TabButton
            active={tab === "positions"}
            icon="▤"
            label="Positions"
            onClick={() => setScreen({ name: "positions" })}
          />
          <TabButton
            active={tab === "wallet"}
            icon="◉"
            label="Wallet"
            onClick={() => setScreen({ name: "wallet" })}
          />
        </nav>
      </div>
    </>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1"
      style={{ color: active ? "var(--ink)" : "var(--faint)" }}
    >
      <span className="text-[15px]" aria-hidden>
        {icon}
      </span>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
