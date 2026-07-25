import type { MDXComponents } from "mdx/types";

/**
 * Global MDX component map. Required by @next/mdx in the App Router.
 * Article typography lives in the .oz-prose class, so these only need to
 * handle things the CSS can't reach.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    a: ({ href, children, ...props }) => {
      const external = typeof href === "string" && /^https?:\/\//.test(href);
      return (
        <a
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          {...props}
        >
          {children}
        </a>
      );
    },
    ...components,
  };
}
