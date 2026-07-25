import type { Metadata } from "next";
import { SiteChrome } from "@/components/site/Chrome";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Is Oddzy custodial? How is it different from a sportsbook? What's the minimum stake? Answers to the common questions about trading prediction markets on Oddzy.",
  alternates: { canonical: "/faq" },
};

const FAQS = [
  {
    q: "Is Oddzy custodial?",
    a: "No. Your wallet is generated through Privy and the keys stay with you. Oddzy never holds or moves your balance — it signs orders you approve, and you can revoke that permission or export your private key at any time.",
  },
  {
    q: "How is this different from a sportsbook?",
    a: "There is no bookmaker setting a margin. Prices come from other users buying and selling shares, so a 62¢ price is a 62% crowd probability rather than odds with a hidden overround. You can also exit a position before resolution, which a fixed-odds bet doesn't allow.",
  },
  {
    q: "What is the minimum stake?",
    a: "$1. Network fees on Polygon are fractions of a cent, so small positions stay economical.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. Oddzy runs inside Telegram as a mini app, and the same site works in a normal browser. There is no app to download and no browser extension to add.",
  },
  {
    q: "Which network and token do I deposit?",
    a: "USDC on Polygon. If you're withdrawing from an exchange, select the Polygon network — USDC sent on Ethereum mainnet will not arrive.",
  },
  {
    q: "How do markets resolve?",
    a: "Resolution happens on-chain through Polymarket. Each market states its resolution source in its rules; disputed outcomes are settled by the UMA optimistic oracle. Winning shares pay $1 each into your wallet.",
  },
  {
    q: "Can I lose money?",
    a: "Yes. You can lose your entire stake on any position. Prediction markets are risky and are not suitable for everyone. 18+.",
  },
];

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <SiteChrome>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-2xl px-5 pt-14 pb-8">
        <h1 className="text-[clamp(28px,5vw,44px)] font-bold tracking-[-0.03em]">
          Frequently asked questions
        </h1>

        <dl className="mt-10 flex flex-col gap-3">
          {FAQS.map((f) => (
            <div
              key={f.q}
              className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6"
            >
              <dt className="text-[17px] font-bold tracking-[-0.01em]">{f.q}</dt>
              <dd className="mt-2.5 text-[15px] leading-relaxed text-[var(--text2)]">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </SiteChrome>
  );
}
