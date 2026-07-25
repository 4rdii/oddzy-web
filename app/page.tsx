import Link from "next/link";
import type { Metadata } from "next";
import { SiteChrome } from "@/components/site/Chrome";
import { getHottest, getMarkets } from "@/lib/api";
import { getAllPosts } from "@/lib/posts";
import { compactUsd, pct } from "@/lib/format";

export const metadata: Metadata = {
  title: "Oddzy — Prediction markets, in your pocket",
  description:
    "Put a price on what happens next. Trade Polymarket prediction markets from Telegram or the web — self-custodial wallet, on-chain settlement, no bookmaker margin.",
  alternates: { canonical: "/" },
};

export const revalidate = 300;

const BOT = process.env.NEXT_PUBLIC_TG_BOT ?? "poly_sport_bet_bot";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oddzy.xyz";

const STEPS = [
  {
    n: "01",
    t: "Wallet in one tap",
    d: "Opening the mini app creates a self-custodial wallet via Privy. No seed phrase, no install, no exchange account.",
  },
  {
    n: "02",
    t: "Price, not a punt",
    d: "A market at 62¢ means the crowd prices that outcome at 62%. Pay 62¢, get $1 if you are right.",
  },
  {
    n: "03",
    t: "Settles on-chain",
    d: "At resolution the market settles on Polygon and proceeds land in your wallet — every step verifiable.",
  },
];

export default async function HomePage() {
  const [hottest, snapshot, posts] = await Promise.all([
    getHottest().catch(() => null),
    getMarkets({ limit: 6 }).catch(() => ({ markets: [] as never[] })),
    getAllPosts(),
  ]);

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Oddzy",
    url: SITE_URL,
    description:
      "An interface to Polymarket prediction markets, available in Telegram and on the web.",
    sameAs: [`https://t.me/${BOT}`],
  };

  return (
    <SiteChrome>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      <section className="mx-auto max-w-5xl px-5 pt-16 pb-10">
        <p className="font-mono text-[11px] tracking-[0.1em] text-[var(--faint)]">
          {snapshot.markets.length > 0
            ? "LIVE MARKETS · UPDATED CONTINUOUSLY"
            : "PREDICTION MARKETS"}
        </p>
        <h1 className="mt-4 max-w-3xl text-[clamp(32px,6vw,56px)] leading-[1.05] font-bold tracking-[-0.03em]">
          Put a price on what you think happens next.
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[var(--text2)]">
          Oddzy is an interface to Polymarket prediction markets. Trade from Telegram or
          right here — your wallet is self-custodial, and every position settles on-chain.
        </p>

        {/* Trading on the web is now the primary path, so the primary CTA leads
            there. Telegram stays as the second button rather than disappearing:
            it is still where most existing users live. */}
        <div className="mt-7 flex flex-wrap gap-3">
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
      </section>

      {/* Live ticker — real prices, the trust signal the plan asks for. */}
      {snapshot.markets.length > 0 && (
        <section className="mx-auto max-w-5xl px-5 py-6">
          <h2 className="font-mono text-[11px] tracking-[0.1em] text-[var(--faint)]">
            TRADING NOW
          </h2>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {snapshot.markets.slice(0, 6).map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3.5"
              >
                <span className="text-[14px] leading-snug font-medium">{m.title}</span>
                <span className="shrink-0 text-end">
                  <span className="block font-mono text-[16px] font-bold text-[var(--up)]">
                    {pct(m.probability.yes)}%
                  </span>
                  <span className="block font-mono text-[10px] text-[var(--faint)]">
                    {compactUsd(m.volume.h24)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {hottest && (
            <p className="mt-4 font-mono text-[11px] text-[var(--faint)]">
              Busiest right now: {hottest.title} · {compactUsd(hottest.volume.h24)} in 24h
            </p>
          )}
        </section>
      )}

      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-[28px] font-bold tracking-[-0.02em]">How it works</h2>
        <ol className="mt-7 grid gap-5 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
              <span className="font-mono text-[11px] tracking-[0.1em] text-[var(--accent)]">
                {s.n}
              </span>
              <h3 className="mt-2 text-[17px] font-bold">{s.t}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--text2)]">{s.d}</p>
            </li>
          ))}
        </ol>
        <Link
          href="/how-it-works"
          className="mt-6 inline-block font-mono text-[12px] text-[var(--accent)]"
        >
          Read the full walkthrough →
        </Link>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[28px] font-bold tracking-[-0.02em]">Learn</h2>
          <Link href="/learn" className="font-mono text-[12px] text-[var(--accent)]">
            All articles →
          </Link>
        </div>
        <ul className="mt-7 grid gap-4 sm:grid-cols-2">
          {posts.slice(0, 4).map((p) => (
            <li key={p.slug}>
              <Link
                href={`/learn/${p.slug}`}
                className="block h-full rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 text-[var(--ink)]"
              >
                <span className="font-mono text-[10px] tracking-[0.1em] text-[var(--accent)]">
                  {p.tag}
                </span>
                <h3 className="mt-2 text-[17px] leading-snug font-bold">{p.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--text2)]">{p.lead}</p>
                <span className="mt-3 block font-mono text-[10px] tracking-[0.08em] text-[var(--faint)]">
                  {p.readingMinutes} MIN READ
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </SiteChrome>
  );
}
