import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { getHottest, getMarkets } from "@/lib/api";
import { getAllPosts } from "@/lib/posts";
import { compactUsd, localized, pct } from "@/lib/format";
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
    title: t.home.metaTitle,
    description: t.home.metaDescription,
    alternates: { canonical: "/" },
  };
}

export const revalidate = 300;

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang);
  const brand = brandFor(lang);

  const [hottest, snapshot, posts] = await Promise.all([
    getHottest().catch(() => null),
    getMarkets({ limit: 6 }).catch(() => ({ markets: [] as never[] })),
    getAllPosts(lang),
  ]);

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.name,
    url: brand.siteUrl,
    description: t.home.orgDescription,
    sameAs: [`https://t.me/${brand.tgBot}`],
  };

  return (
    <SiteChrome lang={lang}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      <section className="mx-auto max-w-5xl px-5 pt-16 pb-10">
        <p className="font-mono text-[11px] tracking-[0.1em] text-[var(--faint)]">
          {snapshot.markets.length > 0 ? t.home.pill : t.home.kicker}
        </p>
        <h1 className="mt-4 max-w-3xl text-[clamp(32px,6vw,56px)] leading-[1.05] font-bold tracking-[-0.03em]">
          {t.home.h1}
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[var(--text2)]">
          {t.home.lead}
        </p>

        {/* Trading on the web is now the primary path, so the primary CTA leads
            there. Telegram stays as the second button rather than disappearing:
            it is still where most existing users live. */}
        <div className="mt-7 flex flex-wrap gap-3">
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
      </section>

      {/* Live ticker — real prices, the trust signal the plan asks for. */}
      {snapshot.markets.length > 0 && (
        <section className="mx-auto max-w-5xl px-5 py-6">
          <h2 className="font-mono text-[11px] tracking-[0.1em] text-[var(--faint)]">
            {t.home.tradingNow}
          </h2>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {snapshot.markets.slice(0, 6).map((m) => (
              <li key={m.id}>
                {/* Each row is the entry point to that market's own page: this
                    is the highest-volume set on the site, so leaving it as dead
                    text stranded the pages that most deserve internal links. */}
                <Link
                  href={`/market/${m.slug}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3.5"
                >
                  <span className="text-[14px] leading-snug font-medium">
                    {localized(lang, m.title, m.title_fa)}
                  </span>
                  <span className="shrink-0 text-end">
                    <span className="block font-mono text-[16px] font-bold text-[var(--up)]">
                      {pct(m.probability.yes)}%
                    </span>
                    <span className="block font-mono text-[10px] text-[var(--faint)]">
                      {compactUsd(m.volume.h24)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {hottest && (
            <p className="mt-4 font-mono text-[11px] text-[var(--faint)]">
              {t.home.busiest}:{" "}
              <Link href={`/market/${hottest.slug}`} className="underline">
                {localized(lang, hottest.title, hottest.title_fa)}
              </Link>{" "}
              · {compactUsd(hottest.volume.h24)} {t.home.in24h}
            </p>
          )}
        </section>
      )}

      {/* Baskets promo band. Plain links, no auth SDK — this page is the most
          crawled thing on the site and must stay cacheable HTML. */}
      <section className="mx-auto max-w-5xl px-5 py-8">
        <div
          className="rounded-2xl border p-6 sm:p-8"
          style={{ borderColor: "var(--bk-goldborder)", background: "var(--bk-goldtint)" }}
        >
          <h2 className="text-[24px] font-bold tracking-[-0.02em] text-[var(--ink)]">
            {t.home.basketsBandTitle}
          </h2>
          <p className="mt-2 max-w-[620px] text-[15px] leading-relaxed text-[var(--text2)]">
            {t.home.basketsBandBody}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href="/baskets"
              className="rounded-xl px-4 py-2.5 text-[14px] font-bold"
              style={{
                background: "var(--bk-cta)",
                color: "var(--bk-cta-ink)",
                boxShadow: "var(--bk-cta-shadow)",
              }}
            >
              {t.home.basketsBandCta}
            </Link>
            {/* The builder, not /basket: that path now redirects to /baskets,
                which is where the primary button already goes — two CTAs to one
                destination is one CTA and a decoy. */}
            <Link
              href="/baskets/new"
              className="text-[14px] font-semibold"
              style={{ color: "var(--bk-gold)" }}
            >
              {t.home.basketsBandSecondary}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-[28px] font-bold tracking-[-0.02em]">{t.home.howItWorks}</h2>
        <ol className="mt-7 grid gap-5 sm:grid-cols-3">
          {t.steps.map((s, i) => (
            <li key={s.t} className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
              <span className="font-mono text-[11px] tracking-[0.1em] text-[var(--accent)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 text-[17px] font-bold">{s.t}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--text2)]">{s.d}</p>
            </li>
          ))}
        </ol>
        <Link
          href="/how-it-works"
          className="mt-6 inline-block font-mono text-[12px] text-[var(--accent)]"
        >
          {t.home.readWalkthrough}
        </Link>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[28px] font-bold tracking-[-0.02em]">{t.home.learn}</h2>
          <Link href="/learn" className="font-mono text-[12px] text-[var(--accent)]">
            {t.home.allArticles}
          </Link>
        </div>
        <ul className="mt-7 grid gap-4 sm:grid-cols-2">
          {posts.slice(0, 4).map((p) => (
            <li key={p.slug}>
              <Link
                href={`/learn/${p.slug}`}
                className="block h-full rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 text-[var(--ink)]"
              >
                <span className="font-mono text-[10px] tracking-[0.1em] text-[var(--accent)]">
                  {p.tag}
                </span>
                <h3 className="mt-2 text-[17px] leading-snug font-bold">{p.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--text2)]">{p.lead}</p>
                <span className="mt-3 block font-mono text-[10px] tracking-[0.08em] text-[var(--faint)]">
                  {p.readingMinutes} {t.home.minRead}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </SiteChrome>
  );
}
