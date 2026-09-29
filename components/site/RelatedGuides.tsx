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
  variant,
}: {
  categoryId?: string | null;
  lang: Locale;
  heading: string;
  lead: string;
  /** "pb": the PolyBaaz redesign's card grid (render inside a `.pb` wrapper). */
  variant?: "pb";
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

  if (variant === "pb") {
    return (
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{heading}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/learn/${p.slug}`}
              className="pb-card-link"
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 16,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                color: "var(--text)",
              }}
              {...(!p.translated && lang !== "en" ? { lang: "en", dir: "ltr" as const } : {})}
            >
              <span style={{ fontSize: 11.5, color: "var(--gold)", fontWeight: 700 }}>{p.tag}</span>
              <span style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.7 }}>{p.title}</span>
            </Link>
          ))}
        </div>
      </section>
    );
  }

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
