import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { getDict } from "@/lib/dict";
import { SiteChrome } from "@/components/site/Chrome";

/**
 * Shown instead of a 404 when a topic, question or market has nothing open:
 * a market that closed or settled, a question whose family was dissolved, a
 * topic whose fights are all over. The URL was real (often still in a cached
 * sitemap or a Telegram post), so the visitor gets an explanation and a way
 * on rather than an error. The page is noindex (see `noMarketMetadata`).
 */
export function NoMarket({ lang, topic }: { lang: Locale; topic?: string }) {
  const t = getDict(lang).gone;
  return (
    <SiteChrome lang={lang}>
      {/* React hoists this into <head>. Needed for topics, whose metadata
          cannot know the page will be empty without fetching it all twice. */}
      <meta name="robots" content="noindex, follow" />
      <div className="mx-auto max-w-xl px-5 pt-20 pb-24 text-center">
        <h1 className="text-[clamp(22px,4vw,30px)] font-bold tracking-[-0.02em]">
          {topic ? t.topicTitle.replace("{topic}", topic) : t.title}
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--text2)]">{t.body}</p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-full bg-[var(--text)] px-5 py-2.5 text-[14px] font-semibold text-[var(--bg)]"
        >
          {t.home}
        </Link>
      </div>
    </SiteChrome>
  );
}

export function noMarketMetadata(lang: Locale) {
  return { title: getDict(lang).gone.metaTitle, robots: { index: false, follow: true } };
}
