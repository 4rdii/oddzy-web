import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { TelegramRedirect } from "./TelegramRedirect";
import { brandFor, type Locale } from "@/lib/i18n";
import { getDict } from "@/lib/dict";

/**
 * Marketing-site chrome. Wraps every crawlable page.
 *
 * Note what is NOT here: any link into /app's screens beyond the CTA, and no
 * Telegram-conditional rendering. This subtree must render identically for a
 * crawler and a human, because it is the SEO surface.
 */
export function SiteChrome({
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
            <nav
              className="flex flex-wrap gap-5 sm:hidden"
              aria-label={t.nav.footerPrimary}
            >
              <NavLink href="/how-it-works">{t.nav.howItWorks}</NavLink>
              <NavLink href="/learn">{t.nav.learn}</NavLink>
              <NavLink href="/faq">{t.nav.faq}</NavLink>
            </nav>
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

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-[14px] font-medium text-[var(--mute)] hover:text-[var(--ink)]">
      {children}
    </Link>
  );
}
