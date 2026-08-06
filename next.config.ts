import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
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
    remarkPlugins: ["remark-frontmatter"],
    rehypePlugins: [],
  },
});

export default withMDX(nextConfig);
