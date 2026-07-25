import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { TelegramRedirect } from "./TelegramRedirect";

const BOT = process.env.NEXT_PUBLIC_TG_BOT ?? "poly_sport_bet_bot";

/**
 * Marketing-site chrome. Wraps every crawlable page.
 *
 * Note what is NOT here: any link into /app's screens beyond the CTA, and no
 * Telegram-conditional rendering. This subtree must render identically for a
 * crawler and a human, because it is the SEO surface.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TelegramRedirect />
      <div className="min-h-screen bg-[var(--page)]">
        <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--page)_90%,transparent)] backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-5 py-3.5">
            <Link href="/" className="flex items-center gap-2.5 text-[var(--ink)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--ink)] text-[13px] font-bold text-[var(--on-ink)]">
                O
              </span>
              <span className="text-[15px] font-bold tracking-[-0.02em]">Oddzy</span>
            </Link>

            <nav className="hidden items-center gap-6 sm:flex" aria-label="Primary">
              <NavLink href="/how-it-works">How it works</NavLink>
              <NavLink href="/learn">Learn</NavLink>
              <NavLink href="/faq">FAQ</NavLink>
            </nav>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <a
                href={`https://t.me/${BOT}`}
                className="min-h-[38px] rounded-lg bg-[var(--ink)] px-3.5 py-2 text-[13px] font-semibold text-[var(--on-ink)]"
              >
                Open in Telegram
              </a>
            </div>
          </div>
        </header>

        <main>{children}</main>

        <footer className="mt-20 border-t border-[var(--line)]">
          <div className="mx-auto max-w-5xl px-5 py-10">
            <nav className="flex flex-wrap gap-5 sm:hidden" aria-label="Footer primary">
              <NavLink href="/how-it-works">How it works</NavLink>
              <NavLink href="/learn">Learn</NavLink>
              <NavLink href="/faq">FAQ</NavLink>
            </nav>
            <p className="mt-4 text-[13px] text-[var(--mute)]">
              © {new Date().getFullYear()} Oddzy · An interface to Polymarket prediction
              markets.
            </p>
            <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-[var(--faint)]">
              Trading prediction markets involves risk of loss and is not suitable for
              everyone. 18+. Oddzy is non-custodial and never holds your funds. Not
              available in restricted jurisdictions.
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
