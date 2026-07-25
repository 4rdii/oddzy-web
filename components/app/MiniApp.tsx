"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import type { Market } from "@/lib/api";
import type { Section } from "@/lib/taxonomy";
import { useTelegram, botLink } from "@/lib/telegram";
import { authedGet } from "@/lib/client-api";
import { MarketsFeed } from "./MarketsFeed";
import { MarketDetail, type PlacedBet } from "./MarketDetail";
import { Receipt } from "./Receipt";
import { PositionsScreen, WalletScreen } from "./AccountScreens";

type Screen =
  | { name: "feed" }
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
  sections,
  initialMarkets,
}: {
  sections: Section[];
  initialMarkets: Market[];
}) {
  const [screen, setScreen] = useState<Screen>({ name: "feed" });
  const { inTelegram } = useTelegram();

  // null means "unknown", which renders the slip without a balance line rather
  // than claiming a fake $0 and blocking the stake as insufficient.
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (inTelegram !== true) return;
    const ctrl = new AbortController();
    authedGet<{ balance: number }>("/api/v1/me", ctrl.signal)
      .then((d) => setBalance(d.balance))
      .catch(() => {
        /* Balance is an affordance, not a gate — the server re-checks funds. */
      });
    return () => ctrl.abort();
  }, [inTelegram]);

  const tab =
    screen.name === "positions" ? "positions" : screen.name === "wallet" ? "wallet" : "markets";

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

          {inTelegram === false && (
            <a
              href={botLink()}
              className="min-h-[36px] rounded-lg bg-[var(--ink)] px-3 py-2 text-[12px] font-semibold text-[var(--on-ink)]"
            >
              Open in Telegram
            </a>
          )}
        </header>

        {screen.name === "feed" && (
          <MarketsFeed
            sections={sections}
            initialMarkets={initialMarkets}
            onOpen={(m) => setScreen({ name: "detail", market: m })}
          />
        )}

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
