import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { brandFor, isLocale } from "@/lib/i18n";
import { getDict } from "@/lib/dict";

/**
 * Privacy policy. Static copy, so it prerenders and costs nothing to serve —
 * and it must never 404: it is the URL the Chrome Web Store listing points at,
 * and a reviewer loads it before a human ever does.
 */
export const revalidate = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDict(lang);
  return {
    title: t.privacy.metaTitle,
    description: t.privacy.metaDescription,
    alternates: { canonical: "/privacy" },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang);
  const brand = brandFor(lang);

  return (
    <SiteChrome lang={lang}>
      <div className="mx-auto max-w-2xl px-5 pt-14 pb-8">
        <h1 className="text-[clamp(28px,5vw,44px)] font-bold tracking-[-0.03em]">{t.privacy.h1}</h1>
        <p className="mt-3 font-mono text-[12px] tracking-[0.06em] text-[var(--faint)]">
          {t.privacy.updated}
        </p>
        <p className="mt-4 text-[17px] leading-relaxed text-[var(--text2)]">{t.privacy.lead}</p>

        <div className="mt-10 flex flex-col gap-4">
          {t.privacy.sections.map((s) => (
            <section key={s.t} className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6">
              <h2 className="text-[19px] font-bold tracking-[-0.01em]">{s.t}</h2>
              <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--text2)]">{s.d}</p>
            </section>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--btn)] p-6">
          <h2 className="text-[17px] font-bold">{t.privacy.contactTitle}</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--text2)]">
            {t.privacy.contactBody}{" "}
            <a href={`https://t.me/${brand.tgBot}`} className="font-semibold text-[var(--ink)] underline">
              @{brand.tgBot}
            </a>
          </p>
        </div>
      </div>
    </SiteChrome>
  );
}
