import Link from "next/link";
import { getTopics } from "@/lib/api";
import type { Locale } from "@/lib/i18n";
import { getGuidesFor } from "@/lib/posts";
import { findPath } from "@/lib/taxonomy";

/**
 * Links from a market, question or topic page into /learn.
 *
 * Async server component on purpose: it resolves the category's place in the
 * topic tree and picks the articles itself, so each page only has to render it.
 * A topic tree that fails to load degrades to matching the category alone,
 * then to the evergreen guides — never to a broken page.
 */
export async function RelatedGuides({
  categoryId,
  lang,
  heading,
  lead,
}: {
  categoryId?: string | null;
  lang: Locale;
  heading: string;
  lead: string;
}) {
  let path: string[] = categoryId ? [categoryId] : [];
  if (categoryId) {
    try {
      path = findPath(await getTopics(), categoryId)?.map((n) => n.id) ?? path;
    } catch {
      // keep the category-only path
    }
  }
  const posts = await getGuidesFor(path, lang);
  if (posts.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-[17px] font-bold tracking-[-0.01em]">{heading}</h2>
      <p className="mt-2 text-[13px] text-[var(--mute)]">{lead}</p>
      <ul className="mt-4 flex flex-col gap-2">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/learn/${p.slug}`}
              className="block rounded-xl border border-[var(--line)] p-4 text-[var(--ink)]"
              {...(!p.translated && lang !== "en" ? { lang: "en", dir: "ltr" as const } : {})}
            >
              <span className="block font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]">
                {p.tag}
              </span>
              <span className="mt-1 block text-[15px] leading-snug font-semibold">{p.title}</span>
              <span className="mt-1 block text-[13px] leading-relaxed text-[var(--text2)]">
                {p.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
