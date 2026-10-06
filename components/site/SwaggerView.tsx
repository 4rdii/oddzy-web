"use client";

import { useEffect, useRef } from "react";

const CDN = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5";

type SwaggerUIBundleFn = (opts: Record<string, unknown>) => unknown;

/**
 * Swagger UI from the CDN, rendering a static OpenAPI file. Read-only:
 * "Try it out" is disabled because the endpoints need a signed-in user, and two
 * of them place real orders.
 */
export function SwaggerView({ specUrl }: { specUrl: string }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${CDN}/swagger-ui.css`;
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = `${CDN}/swagger-ui-bundle.js`;
    script.onload = () => {
      const bundle = (window as unknown as { SwaggerUIBundle?: SwaggerUIBundleFn }).SwaggerUIBundle;
      if (bundle && el.current) {
        bundle({ url: specUrl, domNode: el.current, supportedSubmitMethods: [], docExpansion: "list", defaultModelsExpandDepth: 1 });
      }
    };
    document.body.appendChild(script);
    return () => {
      css.remove();
      script.remove();
    };
  }, [specUrl]);

  return <div ref={el} className="rounded-xl bg-white text-black" dir="ltr" />;
}
