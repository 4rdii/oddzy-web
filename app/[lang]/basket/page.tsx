import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { getBaskets } from "@/lib/api";
import { BRANDS, isLocale, LOCALES } from "@/lib/i18n";
import { getDict } from "@/lib/dict";
import { compactUsd, localized } from "@/lib/format";

/**
 * The basket index.
 *
 * Baskets are the one surface here that is editorial rather than derived from
 * Polymarket, so this page is the entry point for a reader who arrived on a
 * single basket and wants to see the rest.
 */
export const revalidate = 3600;

export async function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { lang } = await props.params;
  if (!isLocale(lang)) return {};
  const t = getDict(lang);
  return {
    title: t.basket.indexMetaTitle,
    description: t.basket.indexMetaDescription,
    alternates: {
      canonical: "/basket",
      languages: Object.fromEntries(
        LOCALES.map((l) => [BRANDS[l].htmlLang, `${BRANDS[l].siteUrl}/basket`]),
      ),
    },
    robots: { index: true, follow: true },
  };
}

export default async function BasketIndexPage(props: Params) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang);
  const baskets = await getBaskets();

  return (
    <SiteChrome lang={lang}>
      <article className="mx-auto max-w-2xl px-5 pt-10 pb-10">
        <h1 className="text-[clamp(24px,4vw,34px)] leading-[1.2] font-bold tracking-[-0.02em]">
          {t.basket.indexH1}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--text2)]">
          {t.basket.indexLead}
        </p>

        {baskets.length === 0 ? (
          <p className="mt-8 text-[15px] text-[var(--mute)]">{t.basket.empty}</p>
        ) : (
          <ul className="mt-8 space-y-3">
            {baskets.map((b) => (
              <li key={b.slug}>
                <Link
                  href={`/basket/${b.slug}`}
                  className="block rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-[17px] font-bold tracking-[-0.01em]">
                      {localized(lang, b.title, b.title_fa)}
                    </h2>
                    {b.curated && (
                      <span className="shrink-0 font-mono text-[10px] tracking-[0.06em] text-[var(--faint)]">
                        {t.basket.curated}
                      </span>
                    )}
                  </div>
                  {(b.description || b.description_fa) && (
                    <p className="mt-2 text-[13px] leading-relaxed text-[var(--mute)]">
                      {localized(lang, b.description ?? "", b.description_fa)}
                    </p>
                  )}
                  <p className="mt-3 font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]">
                    <span className="ltr-num">
                      {t.basket.legCount.replace("{count}", String(b.leg_count))}
                    </span>
                    {b.volume.legs_total ? (
                      <>
                        {" · "}
                        <span className="ltr-num">{compactUsd(b.volume.legs_total)}</span>
                      </>
                    ) : null}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>
    </SiteChrome>
  );
}
