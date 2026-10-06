import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { SwaggerView } from "@/components/site/SwaggerView";
import { isLocale } from "@/lib/i18n";

/**
 * Basket API reference for developers we share it with. Linked from nowhere
 * and noindex: it is a page we hand out, not one we want ranked. The spec is a
 * static file (public/developers/basket-openapi.json) — the public copy of the
 * ops dashboard's, with internal details stripped.
 */
export const revalidate = false;

export const metadata: Metadata = {
  title: "Basket API reference",
  robots: { index: false, follow: false },
};

export default async function BasketApiDocsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <SiteChrome lang={lang}>
      <div className="mx-auto max-w-5xl px-4 pt-10 pb-16" dir="ltr">
        <h1 className="text-[clamp(24px,4vw,32px)] font-bold tracking-[-0.02em]">Basket API reference</h1>
        <p className="mt-2 mb-6 text-[14px] text-[var(--text2)]">
          Endpoints for listing, previewing and buying baskets.{" "}
          <a href="/developers/basket-openapi.json" className="underline">openapi.json</a>
        </p>
        <SwaggerView specUrl="/developers/basket-openapi.json" />
      </div>
    </SiteChrome>
  );
}
