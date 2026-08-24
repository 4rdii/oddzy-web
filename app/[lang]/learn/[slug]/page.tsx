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

  const url = `${brand.siteUrl}/learn/${post.slug}`;
  const articleLang = post.translated ? brand.htmlLang : "en";

  /**
   * Three graphs, for three different readers.
   *
   * BlogPosting is the article itself — `BlogPosting` rather than the previous
   * bare `Article` because it is the more specific type and costs nothing.
   * BreadcrumbList tells a crawler where the page sits. FAQPage is the one that
   * earns its keep with answer engines: it hands them pre-paired questions and
   * answers instead of asking them to infer the pairing from prose.
   *
   * Worth knowing: Google retired FAQ rich results in August 2023 for everyone
   * except government and health sites, so this buys no stars in the SERP. It
   * is emitted for the LLM-backed answer engines, which do read it, and for the
   * day that policy changes back.
   */
  const blogPosting = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: { "@type": "Organization", name: brand.name, url: brand.siteUrl },
    publisher: { "@type": "Organization", name: brand.name, url: brand.siteUrl },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    articleSection: post.tag,
    wordCount: post.wordCount,
    ...(post.keywords.length ? { keywords: post.keywords.join(", ") } : {}),
    // The language of the ARTICLE, which is not the language of the site when
    // a translation is missing — claiming fa-IR over an English body would be
    // a false signal to search engines.
    inLanguage: articleLang,
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t.learn.breadcrumbBlog, item: `${brand.siteUrl}/learn` },
      { "@type": "ListItem", position: 2, name: post.title, item: url },
    ],
  };

  // Only emitted when there is a real FAQ. An empty mainEntity is a structured
  // -data error, and claiming an FAQ the page does not show is the kind of
  // mismatch that gets structured data ignored wholesale.
  const faqLd =
    post.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: articleLang,
          mainEntity: post.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  // Same tag first, then whatever is newest — a reader who just finished a
  // BASICS piece is best served another one. Never links to itself.
  const all = await getAllPosts(lang);
  const related = [
    ...all.filter((p) => p.slug !== post.slug && p.tag === post.tag),
    ...all.filter((p) => p.slug !== post.slug && p.tag !== post.tag),
  ].slice(0, 3);

  // fa-IR resolves to the Jalali calendar and Persian-Indic digits, so a post
  // dated 2026-07-20 reads "۲۹ تیر ۱۴۰۵" rather than a Gregorian date in a
  // Persian sentence.
  const published = new Date(post.publishedAt).toLocaleDateString(
    lang === "fa" ? "fa-IR" : "en-US",
    { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" },
  );

  return (
    <SiteChrome lang={lang}>
      {[blogPosting, breadcrumb, ...(faqLd ? [faqLd] : [])].map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}
      {/* An untranslated article is English text inside an RTL page. Marking it
          keeps the paragraphs left-aligned and stops a screen reader reading
          English with a Persian voice. */}
      <article
        className="mx-auto max-w-2xl px-5 pt-10 pb-8"
        {...(post.translated ? {} : { lang: "en", dir: "ltr" as const })}
      >
        {/* A real trail rather than a bare back-link, because the page emits
            BreadcrumbList — structured data is supposed to describe what the
            reader can actually see. The current page is marked aria-current and
            truncates: an article title is far too long for a crumb. */}
        <nav aria-label="Breadcrumb" className="font-mono text-[11px] text-[var(--mute)]">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/learn" className="hover:text-[var(--ink)]">
                {t.learn.breadcrumbBlog}
              </Link>
            </li>
            <li aria-hidden="true" className="text-[var(--faint)]">
              /
            </li>
            <li
              aria-current="page"
              className="min-w-0 truncate text-[var(--faint)]"
              title={post.title}
            >
              {post.title}
            </li>
          </ol>
        </nav>

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

        {/* The answer-first block. An engine summarising this page should be
            able to take these five lines and be correct, so each one is a
            complete claim rather than a topic label. */}
        {post.takeaways.length > 0 && (
          <section aria-labelledby="key-takeaways" className="oz-callout mt-8">
            <h2 id="key-takeaways" className="oz-callout-title">
              {t.learn.keyTakeaways}
            </h2>
            <ul className="oz-callout-list">
              {post.takeaways.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Only worth showing when there is enough article to get lost in. */}
        {post.headings.length >= 3 && (
          <nav aria-labelledby="on-this-page" className="oz-toc mt-8">
            <h2 id="on-this-page" className="oz-toc-title">
              {t.learn.onThisPage}
            </h2>
            <ol className="oz-toc-list">
              {post.headings.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`}>{h.text}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="oz-prose mt-8">
          <Body />
        </div>

        {/* Rendered from the same array the FAQPage JSON-LD is built from, so
            the two can never disagree — structured data that describes content
            the page does not show is a spam signal, not a bonus. */}
        {post.faq.length > 0 && (
          <section aria-labelledby="faq" className="mt-12">
            <h2 id="faq" className="text-[22px] font-bold tracking-[-0.02em] text-[var(--ink)]">
              {t.learn.faqTitle}
            </h2>
            <dl className="oz-faq mt-5">
              {post.faq.map((item, i) => (
                <div key={i} className="oz-faq-item">
                  <dt>{item.q}</dt>
                  <dd>{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {related.length > 0 && (
          <section aria-labelledby="related" className="mt-12 border-t border-[var(--line)] pt-7">
            <h2
              id="related"
              className="font-mono text-[10px] tracking-[0.1em] text-[var(--faint)]"
            >
              {t.learn.related.toUpperCase()}
            </h2>
            <ul className="mt-4 space-y-4">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/learn/${r.slug}`} className="group block">
                    <span className="font-mono text-[10px] tracking-[0.1em] text-[var(--accent)]">
                      {r.tag}
                    </span>
                    <span className="mt-1 block font-semibold text-[var(--ink)] group-hover:underline">
                      {r.title}
                    </span>
                    <span className="mt-1 block text-[14px] leading-relaxed text-[var(--mute)]">
                      {r.description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </SiteChrome>
  );
}
