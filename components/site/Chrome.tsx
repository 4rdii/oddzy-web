import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { TelegramRedirect } from "./TelegramRedirect";
import { brandFor, type Locale } from "@/lib/i18n";
import { getDict } from "@/lib/dict";
import { getTopics } from "@/lib/api";
import { publishedTopicSlugs } from "@/lib/topic-slugs";
import type { Topic } from "@/lib/taxonomy";

/**
 * Marketing-site chrome. Wraps every crawlable page.
 *
 * Note what is NOT here: any link into /app's screens beyond the CTA, and no
 * Telegram-conditional rendering. This subtree must render identically for a
 * crawler and a human, because it is the SEO surface.
 *
 * The footer carries a topic directory, and that is load-bearing for indexing
 * rather than decoration. Google follows links; a URL that appears only in a
 * sitemap is a hint it is free to ignore, and on a young domain it usually
 * does — which is how 221 submitted URLs ended up with 6 indexed. Topic pages
 * each link ~34 markets, so linking the topics from every page puts the entire
 * catalogue two hops from any entry point.
 */
export async function SiteChrome({
  lang,
  children,
}: {
  lang: Locale;
  children: React.ReactNode;
}) {
  const brand = brandFor(lang);
  const t = getDict(lang);
  const fa = lang === "fa";

  /**
   * PolyBaaz dates in the Jalali calendar (© ۱۴۰۵), so the footer year cannot be
   * getFullYear(). Intl resolves both the calendar and the digit set from the
   * locale tag.
   */
  const year = new Intl.DateTimeFormat(fa ? "fa-IR" : "en-US", {
    year: "numeric",
  }).format(new Date());

  // Flattened so a crawler reaches every topic in one hop, not four. Sections
  // that hold no markets of their own are still worth linking — they are the
  // pages that link onward to the leaves. Empty on API failure, which degrades
  // to today's footer rather than failing the page.
  const [tree, published] = await Promise.all([
    getTopics().catch(() => []),
    publishedTopicSlugs().catch(() => new Set<string>()),
  ]);
  // Filtered against the pages that actually exist. The bot's topic tree is far
  // larger than the set of prerendered hubs, and linking the difference put 14
  // 404s in the footer of every page — worse for crawling than no links at all.
  // Filter BEFORE capping: capping first lets unpublished nodes near the top of
  // the tree consume the budget and push real hubs out of the footer entirely.
  const topics = flattenTopics(tree)
    .filter((x) => published.has(x.id))
    .slice(0, FOOTER_TOPIC_LIMIT);

  return (
    <>
      <TelegramRedirect />
      <div className="min-h-screen bg-[var(--page)]">
        <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--page)_90%,transparent)] backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-5 py-3.5">
            <Link href="/" className="flex items-center gap-2.5 text-[var(--ink)]">
              {/* The bot's own avatar. Both files bake in their background, so
                  no ring or fill is needed behind them in either theme. */}
              <Image
                src={brand.logo}
                alt=""
                width={28}
                height={28}
                priority
                className="h-7 w-7 rounded-[9px]"
              />
              <span className="text-[15px] font-bold tracking-[-0.02em]">
                {brand.name}
              </span>
            </Link>

            <nav
              className="hidden items-center gap-6 sm:flex"
              aria-label={t.nav.primary}
            >
              {/* Baskets sits first: it is the only nav item that leads to
                  something buyable, and /basket is the crawlable editorial index
                  rather than the noindex community feed — the right landing
                  place for someone who has not chosen a basket yet. The feed and
                  the builder are reached from there and from the home band. */}
              <NavLink href="/baskets">{t.nav.baskets}</NavLink>
              <NavLink href="/how-it-works">{t.nav.howItWorks}</NavLink>
              <NavLink href="/learn">{t.nav.learn}</NavLink>
              <NavLink href="/faq">{t.nav.faq}</NavLink>
            </nav>

            <div className="flex items-center gap-2">
              <ThemeToggle labels={t.theme} />
              {/* Links into /app rather than calling Privy directly: this
                  chrome wraps the crawlable pages and sits outside the provider,
                  and loading an auth SDK on the blog would be a poor trade for a
                  button most visitors never press. /app presents the login. */}
              <Link
                href="/app"
                className={
                  fa
                    ? "min-h-[38px] rounded-[12px] bg-[var(--accent)] px-3.5 py-2 text-[13px] font-bold text-[var(--accent-ink)]"
                    : "min-h-[38px] rounded-lg bg-[var(--ink)] px-3.5 py-2 text-[13px] font-semibold text-[var(--on-ink)]"
                }
              >
                {t.nav.signIn}
              </Link>
            </div>
          </div>
        </header>

        <main>{children}</main>

        <footer className="mt-20 border-t border-[var(--line)]">
          <div className="mx-auto max-w-5xl px-5 py-10">
            {/* Not hidden at any breakpoint: the previous footer nav was
                `sm:hidden`, so on desktop the site shipped a footer with no
                links in it at all. */}
            <nav
              className="flex flex-wrap gap-x-5 gap-y-3"
              aria-label={t.nav.footerPrimary}
            >
              <NavLink href="/how-it-works">{t.nav.howItWorks}</NavLink>
              <NavLink href="/learn">{t.nav.learn}</NavLink>
              <NavLink href="/updown">{t.nav.updown}</NavLink>
              <NavLink href="/baskets">{t.nav.baskets}</NavLink>
              <NavLink href="/faq">{t.nav.faq}</NavLink>
            </nav>

            {topics.length > 0 && (
              <nav className="mt-8" aria-label={t.nav.browseTopics}>
                <h2 className="font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]">
                  {t.nav.browseTopics}
                </h2>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                  {topics.map((topic) => (
                    <li key={topic.id}>
                      <Link
                        href={`/topic/${topic.id}`}
                        className="text-[13px] text-[var(--mute)] hover:text-[var(--ink)]"
                      >
                        {fa ? (topic.name_fa ?? topic.name) : topic.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            <p className="mt-4 text-[13px] text-[var(--mute)]">
              © {year} {brand.name} · {t.footer.rights}
            </p>
            <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-[var(--faint)]">
              {t.footer.risk}
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}

/**
 * How many topic links the footer will carry.
 *
 * Capped because a footer is a link-equity divider as well as a crawl path —
 * every link on a page shares the same budget, so an unbounded directory
 * dilutes each entry and starts to look like a link farm.
 */
const FOOTER_TOPIC_LIMIT = 40;

/** Depth-first flatten of the topic tree. Capping happens after filtering. */
function flattenTopics(tree: Topic[]): Topic[] {
  const out: Topic[] = [];
  const walk = (nodes: Topic[]) => {
    for (const n of nodes) {
      out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(tree);
  return out;
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-[14px] font-medium text-[var(--mute)] hover:text-[var(--ink)]">
      {children}
    </Link>
  );
}
