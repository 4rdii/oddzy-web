import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { getAllPosts } from "@/lib/posts";
import { isLocale } from "@/lib/i18n";
import { getDict } from "@/lib/dict";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDict(lang);
  return {
    title: t.learn.metaTitle,
    description: t.learn.metaDescription,
    alternates: { canonical: "/learn" },
  };
}

export default async function LearnPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang);

  const posts = await getAllPosts(lang);

  return (
    <SiteChrome lang={lang}>
      <div className="mx-auto max-w-5xl px-5 pt-14 pb-6">
        <h1 className="text-[clamp(28px,5vw,44px)] font-bold tracking-[-0.03em]">
          {t.learn.h1}
        </h1>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[var(--text2)]">
          {t.learn.lead}
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
                {p.readingMinutes} {t.learn.minRead}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </SiteChrome>
  );
}
