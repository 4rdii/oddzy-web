import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { getAllPosts, getPost } from "@/lib/posts";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oddzy.xyz";

/** Pre-render every article at build time — this is the SEO surface. */
export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/learn/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/learn/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      url: `${SITE_URL}/learn/${post.slug}`,
    },
  };
}

export default async function ArticlePage(props: PageProps<"/learn/[slug]">) {
  const { slug } = await props.params;
  const post = await getPost(slug);
  if (!post) notFound();

  // Dynamic import of the MDX body — the loader compiles it to a component.
  const { default: Body } = await import(`@/content/posts/${slug}.mdx`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: { "@type": "Organization", name: "Oddzy" },
    publisher: { "@type": "Organization", name: "Oddzy" },
    mainEntityOfPage: `${SITE_URL}/learn/${post.slug}`,
  };

  return (
    <SiteChrome>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="mx-auto max-w-2xl px-5 pt-10 pb-8">
        <Link href="/learn" className="font-mono text-[11px] text-[var(--mute)]">
          ← All articles
        </Link>

        <span className="mt-6 block font-mono text-[10px] tracking-[0.1em] text-[var(--accent)]">
          {post.tag}
        </span>
        <h1 className="mt-2 text-[clamp(26px,4.5vw,38px)] leading-[1.15] font-bold tracking-[-0.03em]">
          {post.title}
        </h1>
        <p className="mt-3 font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]">
          <time dateTime={post.publishedAt}>
            {new Date(post.publishedAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}
          </time>
          {" · "}
          {post.readingMinutes} MIN READ
        </p>

        <p className="mt-6 border-s-2 border-[var(--accent)] ps-4 text-[17px] leading-relaxed text-[var(--ink)]">
          {post.lead}
        </p>

        <div className="oz-prose mt-8">
          <Body />
        </div>
      </article>
    </SiteChrome>
  );
}
