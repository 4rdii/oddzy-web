import type { Metadata } from "next";
import Link from "next/link";
import { SiteChrome } from "@/components/site/Chrome";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Deposit, pick, settle. How trading prediction markets on Oddzy works step by step — wallet creation, funding on Polygon, placing a position, and on-chain resolution.",
  alternates: { canonical: "/how-it-works" },
};

const BOT = process.env.NEXT_PUBLIC_TG_BOT ?? "poly_sport_bet_bot";

const STEPS = [
  {
    n: "01",
    t: "Open the bot, get a wallet",
    d: "Start the bot in Telegram and open the mini app. A self-custodial wallet is created for you through Privy — no seed phrase to record, no extension to install, no exchange account. The keys are yours: you can export them or revoke signing permission whenever you want.",
  },
  {
    n: "02",
    t: "Fund it with USDC on Polygon",
    d: "You get a deposit address. Send USDC on the Polygon network — from an exchange withdrawal or another wallet. Deposits are detected automatically and your balance updates in the bot. The minimum stake is $1, so a small first deposit is fine.",
  },
  {
    n: "03",
    t: "Pick a market and a side",
    d: "Browse by category. Each market shows YES and NO prices in cents, volume traded, and the resolution date. A price of 62¢ means the market prices that outcome at about 62% — you pay 62 cents for a share that pays $1 if you're right.",
  },
  {
    n: "04",
    t: "Confirm — the order signs on-chain",
    d: "Check the payout preview, then confirm. The order is signed from your wallet and submitted to Polymarket's order book. You get a receipt with the transaction hash. Orders are filled at the best available price, capped so a thin book can't fill you far above the quote.",
  },
  {
    n: "05",
    t: "Hold, or exit early",
    d: "Your position shows live P&L. Unlike a fixed-odds bet, you can sell before resolution at the current market price — taking a profit or cutting a loss if your view changes.",
  },
  {
    n: "06",
    t: "Settlement",
    d: "When the market resolves, winning shares pay $1 each directly to your wallet. Resolution happens on-chain via Polymarket's oracle; disputed outcomes go to the UMA optimistic oracle.",
  },
];

export default function HowItWorksPage() {
  return (
    <SiteChrome>
      <div className="mx-auto max-w-2xl px-5 pt-14 pb-8">
        <h1 className="text-[clamp(28px,5vw,44px)] font-bold tracking-[-0.03em]">
          How it works
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-[var(--text2)]">
          Deposit, pick, settle. Six steps from a cold start to a settled position.
        </p>

        <ol className="mt-10 flex flex-col gap-4">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6">
              <span className="font-mono text-[11px] tracking-[0.1em] text-[var(--accent)]">
                {s.n}
              </span>
              <h2 className="mt-2 text-[19px] font-bold tracking-[-0.01em]">{s.t}</h2>
              <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--text2)]">{s.d}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-2xl border border-[var(--line)] bg-[var(--btn)] p-6">
          <h2 className="text-[17px] font-bold">Before you start</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--text2)]">
            You can lose your entire stake. Prices move against you, thin markets fill worse
            than the quote suggests, and markets you were confident about resolve the other
            way often enough to matter. Stake what you can afford to lose. 18+.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/app"
            className="min-h-[50px] rounded-xl bg-[var(--ink)] px-6 py-3.5 font-semibold text-[var(--on-ink)]"
          >
            Start trading
          </Link>
          <a
            href={`https://t.me/${BOT}`}
            className="min-h-[50px] rounded-xl border border-[var(--line)] bg-[var(--btn)] px-6 py-3.5 font-semibold text-[var(--ink)]"
          >
            Open in Telegram
          </a>
        </div>
      </div>
    </SiteChrome>
  );
}
