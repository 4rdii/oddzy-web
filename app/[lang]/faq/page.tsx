import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { isLocale } from "@/lib/i18n";
import { getDict } from "@/lib/dict";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDict(lang);
  return {
    title: t.faq.metaTitle,
    description: t.faq.metaDescription,
    alternates: { canonical: "/faq" },
  };
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: t.faq.items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <SiteChrome lang={lang}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-2xl px-5 pt-14 pb-8">
        <h1 className="text-[clamp(28px,5vw,44px)] font-bold tracking-[-0.03em]">
          {t.faq.h1}
        </h1>

        <dl className="mt-10 flex flex-col gap-3">
          {t.faq.items.map((f) => (
            <div
              key={f.q}
              className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6"
            >
              <dt className="text-[17px] font-bold tracking-[-0.01em]">{f.q}</dt>
              <dd className="mt-2.5 text-[15px] leading-relaxed text-[var(--text2)]">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </SiteChrome>
  );
}
