import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { getAllPosts, getPost } from "@/lib/posts";
import { BRANDS, brandFor, isLocale, LOCALES } from "@/lib/i18n";
import { getDict } from "@/lib/dict";

/** Pre-render every article, per locale — this is the SEO surface. */
export async function generateStaticParams() {
  const posts = await getAllPosts();
  return LOCALES.flatMap((lang) => posts.map((p) => ({ lang, slug: p.slug })));
}

type ArticleParams = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata(props: ArticleParams): Promise<Metadata> {
  const { lang, slug } = await props.params;
  if (!isLocale(lang)) return {};
  const post = await getPost(slug, lang);
  if (!post) return {};
  const siteUrl = brandFor(lang).siteUrl;
  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: `/learn/${post.slug}`,
      // The same slug is the same article in both languages on two different
      // hostnames. Without hreflang, Google can read the pair as duplicates and
      // pick one host for both audiences — tell it they're translations.
      languages: Object.fromEntries(
        LOCALES.map((l) => [
          BRANDS[l].htmlLang,
          `${BRANDS[l].siteUrl}/learn/${post.slug}`,
        ]),
      ),
    },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      url: `${siteUrl}/learn/${post.slug}`,
    },
  };
}

export default async function ArticlePage(props: ArticleParams) {
  const { lang, slug } = await props.params;
  if (!isLocale(lang)) notFound();
  const post = await getPost(slug, lang);
  if (!post) notFound();

  const brand = brandFor(lang);
  const t = getDict(lang);

  // Dynamic import of the MDX body — the loader compiles it to a component.
  // Both arms are template literals with a fixed prefix and suffix so the
  // bundler can resolve them to a directory of candidates at build time.
  // `post.translated` is what getPost actually read, so a post without a
  // Persian file imports the English body instead of failing the route.
  const { default: Body } =
    lang !== "en" && post.translated
      ? await import(`@/content/posts/${slug}.${lang}.mdx`)
      : await import(`@/content/posts/${slug}.mdx`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: { "@type": "Organization", name: brand.name },
    publisher: { "@type": "Organization", name: brand.name },
    mainEntityOfPage: `${brand.siteUrl}/learn/${post.slug}`,
    // The language of the ARTICLE, which is not the language of the site when
    // a translation is missing — claiming fa-IR over an English body would be
    // a false signal to search engines.
    inLanguage: post.translated ? brand.htmlLang : "en",
  };

  // fa-IR resolves to the Jalali calendar and Persian-Indic digits, so a post
  // dated 2026-07-20 reads "۲۹ تیر ۱۴۰۵" rather than a Gregorian date in a
  // Persian sentence.
  const published = new Date(post.publishedAt).toLocaleDateString(
    lang === "fa" ? "fa-IR" : "en-US",
    { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" },
  );

  return (
    <SiteChrome lang={lang}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* An untranslated article is English text inside an RTL page. Marking it
          keeps the paragraphs left-aligned and stops a screen reader reading
          English with a Persian voice. */}
      <article
        className="mx-auto max-w-2xl px-5 pt-10 pb-8"
        {...(post.translated ? {} : { lang: "en", dir: "ltr" as const })}
      >
        <Link href="/learn" className="font-mono text-[11px] text-[var(--mute)]">
          {t.learn.backToAll}
        </Link>

        <span className="mt-6 block font-mono text-[10px] tracking-[0.1em] text-[var(--accent)]">
          {post.tag}
        </span>
        <h1 className="mt-2 text-[clamp(26px,4.5vw,38px)] leading-[1.15] font-bold tracking-[-0.03em]">
          {post.title}
        </h1>
        <p className="mt-3 font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]">
          <time dateTime={post.publishedAt}>{published}</time>
          {" · "}
          {post.readingMinutes} {t.learn.minRead}
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
