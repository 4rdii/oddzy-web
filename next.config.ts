import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],

  /**
   * Baskets moved from /basket to /baskets when the editorial index and the
   * community feed became one page.
   *
   * These are not tidiness — they are load-bearing. /basket/<slug> links are
   * already published: in Telegram channel posts we cannot edit, in indexed
   * /learn articles, and in the JSON the basket admin API hands the content
   * agent. Dropping the old path would 404 all of them.
   *
   * The locale-prefixed forms are here because they were reachable too: the
   * host->locale rewrite in proxy.ts means /fa/basket/<slug> renders, and links
   * in that shape were shared before the prefix was removed from our own
   * markup. 308 keeps the method and tells crawlers the move is permanent, so
   * the ranking on those article-linked pages follows.
   */
  async redirects() {
    return [
      { source: "/basket", destination: "/baskets", permanent: true },
      { source: "/basket/:slug", destination: "/baskets/:slug", permanent: true },
      { source: "/:lang(en|fa)/basket", destination: "/baskets", permanent: true },
      { source: "/:lang(en|fa)/basket/:slug", destination: "/baskets/:slug", permanent: true },
    ];
  },
};

const withMDX = createMDX({
  options: {
    // @next/mdx does not handle frontmatter on its own: the `---` fences and the
    // YAML between them parse as ordinary markdown, and a paragraph followed by
    // `---` is a setext heading — so the whole block rendered as one giant <h2>
    // at the top of every article. gray-matter reads that frontmatter in
    // lib/posts.ts for the page chrome; this parses it in the MDX pipeline too,
    // so the body drops it rather than printing it.
    //
    // Named as a string, not imported: plugins reach the Turbopack loader across
    // a Rust boundary that can't take JavaScript functions.
    // remark-gfm is what gives MDX pipe tables. Without it the base CommonMark
    // parser treats `| a | b |` as an ordinary paragraph and the table renders
    // as literal pipes — which is exactly what shipped once. globals.css has
    // styled `.oz-prose table` since launch, so the styling was waiting for a
    // parser that never got wired up. It also brings strikethrough, task lists
    // and autolinks, all of which are safe here.
    remarkPlugins: ["remark-frontmatter", "remark-gfm"],
    // rehype-slug puts an `id` on every heading so the table of contents can
    // link into the body. lib/posts.ts derives the same ids from the raw MDX
    // with github-slugger, which is the algorithm rehype-slug uses — the two
    // must agree or every TOC link is a dead anchor.
    rehypePlugins: ["rehype-slug"],
  },
});

export default withMDX(nextConfig);
