import Link from "next/link";
import type { Metadata } from "next";
import { SiteChrome } from "@/components/site/Chrome";
import { getAllPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Learn — prediction markets explained",
  description:
    "Guides and analysis on prediction markets: how prices become probabilities, how they differ from sportsbooks, and how to trade them from Telegram.",
  alternates: { canonical: "/learn" },
};

export default async function LearnPage() {
  const posts = await getAllPosts();

  return (
    <SiteChrome>
      <div className="mx-auto max-w-5xl px-5 pt-14 pb-6">
        <h1 className="text-[clamp(28px,5vw,44px)] font-bold tracking-[-0.03em]">Learn</h1>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[var(--text2)]">
          How prediction markets work, what the prices actually mean, and how to trade them
          without getting the basics wrong.
        </p>
      </div>

      <ul className="mx-auto grid max-w-5xl gap-4 px-5 pb-10 sm:grid-cols-2">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/learn/${p.slug}`}
              className="block h-full rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6 text-[var(--ink)]"
            >
              <span className="font-mono text-[10px] tracking-[0.1em] text-[var(--accent)]">
                {p.tag}
              </span>
              <h2 className="mt-2 text-[19px] leading-snug font-bold tracking-[-0.01em]">
                {p.title}
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--text2)]">{p.lead}</p>
              <span className="mt-4 block font-mono text-[10px] tracking-[0.08em] text-[var(--faint)]">
                {p.readingMinutes} MIN READ
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </SiteChrome>
  );
}
