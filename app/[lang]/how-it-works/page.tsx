import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { brandFor, isLocale } from "@/lib/i18n";
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
    title: t.how.metaTitle,
    description: t.how.metaDescription,
    alternates: { canonical: "/how-it-works" },
  };
}

export default async function HowItWorksPage({
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
        <h1 className="text-[clamp(28px,5vw,44px)] font-bold tracking-[-0.03em]">
          {t.how.h1}
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-[var(--text2)]">
          {t.how.lead}
        </p>

        <ol className="mt-10 flex flex-col gap-4">
          {t.how.steps.map((s, i) => (
            <li key={s.t} className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6">
              <span className="font-mono text-[11px] tracking-[0.1em] text-[var(--accent)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="mt-2 text-[19px] font-bold tracking-[-0.01em]">{s.t}</h2>
              <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--text2)]">{s.d}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-2xl border border-[var(--line)] bg-[var(--btn)] p-6">
          <h2 className="text-[17px] font-bold">{t.how.beforeYouStart}</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--text2)]">
            {t.how.risk}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/app"
            className="min-h-[50px] rounded-xl bg-[var(--ink)] px-6 py-3.5 font-semibold text-[var(--on-ink)]"
          >
            {t.cta.startTrading}
          </Link>
          <a
            href={`https://t.me/${brand.tgBot}`}
            className="min-h-[50px] rounded-xl border border-[var(--line)] bg-[var(--btn)] px-6 py-3.5 font-semibold text-[var(--ink)]"
          >
            {t.cta.openTelegram}
          </a>
        </div>
      </div>
    </SiteChrome>
  );
}
