import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

/**
 * Blog index.
 *
 * Posts are MDX files in content/posts. This module only reads frontmatter —
 * the body is compiled by the MDX loader when [slug]/page.tsx imports the file,
 * so the index never pays to parse article bodies.
 *
 * The blog is a WEB-ONLY surface: it exists for search, and the mini app never
 * links to it. Nothing here is imported by the /app route.
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
};

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

export async function getAllPosts(): Promise<PostMeta[]> {
  let files: string[];
  try {
    files = await fs.readdir(POSTS_DIR);
  } catch {
    return [];
  }

  const posts = await Promise.all(
    files
      .filter((f) => f.endsWith(".mdx"))
      .map(async (file) => {
        const raw = await fs.readFile(path.join(POSTS_DIR, file), "utf8");
        const { data } = matter(raw);
        return {
          slug: file.replace(/\.mdx$/, ""),
          title: String(data.title ?? ""),
          description: String(data.description ?? ""),
          tag: String(data.tag ?? "GUIDE"),
          readingMinutes: Number(data.readingMinutes ?? 6),
          publishedAt: String(data.publishedAt ?? ""),
          updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
          lead: String(data.lead ?? data.description ?? ""),
        } satisfies PostMeta;
      }),
  );

  // Newest first. Posts without a date sort last rather than throwing.
  return posts.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

export async function getPost(slug: string): Promise<PostMeta | null> {
  const posts = await getAllPosts();
  return posts.find((p) => p.slug === slug) ?? null;
}
