import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { DEFAULT_LOCALE, type Locale } from "./i18n";

/**
 * Blog index.
 *
 * Posts are MDX files in content/posts. This module only reads frontmatter —
 * the body is compiled by the MDX loader when [slug]/page.tsx imports the file,
 * so the index never pays to parse article bodies.
 *
 * The blog is a WEB-ONLY surface: it exists for search, and the mini app never
 * links to it. Nothing here is imported by the /app route.
 *
 * ## Translations
 *
 * A post is one slug with one file per locale: `<slug>.mdx` is English and
 * `<slug>.fa.mdx` is its Persian counterpart. The slug is shared deliberately —
 * `/learn/what-is-a-prediction-market` is the same article on both hostnames,
 * so the canonical/alternate URLs stay parallel and a link shared between the
 * two brands lands on the right language rather than 404ing.
 *
 * A missing translation falls back to English rather than hiding the post: a
 * PolyBaaz reader seeing an English article is worse than nothing on the page,
 * but only slightly, and it means a new post ships to both brands the day it's
 * written. `translated` records which happened so the page can import the right
 * body and mark the language of what it actually rendered.
 */

export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  tag: string;
  readingMinutes: number;
  publishedAt: string;
  updatedAt?: string;
  lead: string;
  /** False when this locale fell back to the English file. */
  translated: boolean;
};

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

/** `foo.fa.mdx` for a translated locale, `foo.mdx` for the source language. */
function fileFor(slug: string, locale: Locale): string {
  return locale === DEFAULT_LOCALE ? `${slug}.mdx` : `${slug}.${locale}.mdx`;
}

export async function getAllPosts(locale: Locale = DEFAULT_LOCALE): Promise<PostMeta[]> {
  let files: string[];
  try {
    files = await fs.readdir(POSTS_DIR);
  } catch {
    return [];
  }

  // English files define the post set. Translations are variants of those
  // slugs, never posts of their own — a stray `foo.fa.mdx` with no English
  // original would otherwise appear as a post slugged "foo.fa".
  const slugs = files
    .filter((f) => f.endsWith(".mdx") && !/\.[a-z]{2}\.mdx$/.test(f))
    .map((f) => f.replace(/\.mdx$/, ""));

  const posts = await Promise.all(slugs.map((slug) => read(slug, locale)));

  // Newest first. Posts without a date sort last rather than throwing.
  return posts
    .filter((p): p is PostMeta => p !== null)
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

export async function getPost(
  slug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<PostMeta | null> {
  // Guard the path join: `slug` arrives from the URL.
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  return read(slug, locale);
}

async function read(slug: string, locale: Locale): Promise<PostMeta | null> {
  let raw: string | null = await readFile(fileFor(slug, locale));
  const translated = raw !== null;
  if (raw === null && locale !== DEFAULT_LOCALE) {
    raw = await readFile(fileFor(slug, DEFAULT_LOCALE));
  }
  if (raw === null) return null;

  const { data } = matter(raw);
  return {
    slug,
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    tag: String(data.tag ?? "GUIDE"),
    readingMinutes: Number(data.readingMinutes ?? 6),
    publishedAt: String(data.publishedAt ?? ""),
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
    lead: String(data.lead ?? data.description ?? ""),
    translated,
  } satisfies PostMeta;
}

async function readFile(file: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(POSTS_DIR, file), "utf8");
  } catch {
    return null;
  }
}
