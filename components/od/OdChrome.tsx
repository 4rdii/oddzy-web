import Image from "next/image";
import Link from "next/link";
import { OdNav, OdThemeButton, OdWire } from "./OdHeaderParts";

/**
 * oddzy.xyz site chrome from the redesign (OdHeader / OdFooter): the live
 * wire, the nav (politics and economy first, Sports last and quiet), and a
 * footer that keeps the crawlable topic directory SiteChrome has always
 * carried (see the note there on why it is load-bearing).
 */
export function OdChrome({
  active,
  topics,
  children,
}: {
  /** Nav key to mark ("home" | "pol" | "eco" | "war" | …) when the path alone can't tell. */
  active?: string;
  topics: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="od">
      <header className="od-header">
        <OdWire />
        <div className="od-bar">
          <Link href="/" aria-label="Oddzy home" style={{ display: "flex", alignItems: "center", gap: 10, flex: "none", height: 60 }}>
            <Image src="/logo-en.jpg" alt="" width={30} height={30} priority style={{ width: 30, height: 30, borderRadius: 9 }} />
            <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-.03em", color: "var(--od-ink)" }}>Oddzy</span>
          </Link>
          <OdNav active={active} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none", marginInlineStart: "auto", order: 2 }}>
            <OdThemeButton />
            <Link
              href="/app"
              style={{
                height: 36,
                padding: "0 16px",
                borderRadius: 8,
                background: "var(--od-brand)",
                color: "var(--od-brandInk)",
                fontWeight: 700,
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                whiteSpace: "nowrap",
              }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer style={{ borderTop: "1px solid var(--od-line)", marginTop: 72 }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "32px clamp(16px,3vw,32px) 40px", display: "grid", gap: 18 }}>
          <nav aria-label="Footer" style={{ display: "flex", flexWrap: "wrap", gap: "8px 22px", fontSize: 14, fontWeight: 600, color: "var(--od-ink2)" }}>
            <Link href="/">World Map</Link>
            <Link href="/topic/politics">Politics</Link>
            <Link href="/topic/economy">Economy</Link>
            <Link href="/topic/world">War &amp; Geopolitics</Link>
            <Link href="/baskets">Baskets</Link>
            <Link href="/learn">Learn</Link>
            <Link href="/how-it-works">How it works</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/extension" style={{ color: "var(--od-brand)" }}>
              Get the extension
            </Link>
            <Link href="/live" style={{ color: "var(--od-ink3)", fontWeight: 500 }}>
              Sports
            </Link>
            <Link href="/privacy" style={{ color: "var(--od-ink3)", fontWeight: 500 }}>
              Privacy
            </Link>
          </nav>
          {topics.length > 0 && (
            <nav aria-label="Browse topics" style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 12.5, color: "var(--od-ink3)" }}>
              {topics.map((t) => (
                <Link key={t.id} href={`/topic/${t.id}`}>
                  {t.name}
                </Link>
              ))}
            </nav>
          )}
          <p style={{ margin: 0, maxWidth: 720, fontSize: 12.5, lineHeight: 1.6, color: "var(--od-ink3)" }}>
            © {new Date().getFullYear()} Oddzy · An interface to Polymarket prediction markets. Trading prediction markets
            involves risk of loss and is not suitable for everyone. 18+. Oddzy is non-custodial and never holds your funds.
            Not available in restricted jurisdictions.
          </p>
        </div>
      </footer>
    </div>
  );
}
