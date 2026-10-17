import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/site/Chrome";
import { BrowserMock, InstallCta } from "@/components/od/OdExtension";
import { OdExtSetup } from "@/components/od/OdExtSetup";
import { OdMiniGlobe } from "@/components/od/OdMiniGlobe";
import { getDesk } from "@/lib/api";
import { finderRows, globeCountries, indexDesk } from "@/lib/desk";
import { isLocale } from "@/lib/i18n";
import { pct } from "@/lib/od";

/**
 * Market Finder, the Chrome extension: pitch and install (design: "Oddzy
 * Extension"). oddzy.xyz only — the extension is English-first and PolyBaaz
 * does not link to it.
 */
export const revalidate = 3600;

export function generateStaticParams() {
  return [{ lang: "en" }];
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (lang !== "en") return {};
  const title = "Market Finder for Chrome — live odds next to the news";
  const description = "Click Market Finder on any news article and see the prediction markets that answer it, with live odds. Free for Chrome, Edge and Brave.";
  return { title: { absolute: `${title} · Oddzy` }, description, alternates: { canonical: "/extension" }, openGraph: { title, description, url: "/extension" } };
}

const PRIVACY: [string, string][] = [
  ["Reads a page only when you click Scan", "Nothing runs in the background unless you turn it on."],
  ["Auto-scan is optional", "It asks for permission first, and you can limit it to the sites you choose."],
  ["History stays in your browser", "Your scan history is stored locally, not on our servers."],
  ["Never trades or holds funds", "Trade links open oddzy.xyz. Nothing is bought from the extension."],
];

const FAQ: [string, string][] = [
  ["Which browsers does it work in?", "Chrome, Edge and Brave on desktop. It is not available on phones."],
  ["Does it read every page I visit?", "No. It reads the page you are on only when you click Scan. Auto-scan is off until you allow it, and you can limit it to chosen sites."],
  ["What does it send to Oddzy?", "Up to 4,000 characters of the article’s text when you press Scan, so we can find the markets that answer it. It is kept only in a short-lived cache. See the privacy policy for details."],
  ["Can it place trades for me?", "No. It never places trades or holds funds. The Trade button opens the market on oddzy.xyz, where you decide."],
  ["Which languages does it understand?", "English and Persian articles."],
];

export default async function ExtensionPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang) || lang !== "en") notFound();
  const desk = await getDesk(revalidate);
  const ix = desk ? indexDesk(desk) : null;
  const rows = ix ? finderRows(ix) : [];
  const globe = ix ? globeCountries(ix, 0).map((c) => ({ id: c.id, name: c.name, v: c.v, r: c.r, links: c.links })) : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };

  return (
    <SiteChrome lang="en">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="od-main">
        <section className="od-ext-hero">
          <div style={{ display: "grid", gap: 20, minWidth: 0, position: "relative", zIndex: 1 }}>
            <span className="kicker" style={{ fontSize: 11.5 }}>
              Market Finder · Browser extension
            </span>
            <h1 className="serif" style={{ margin: 0, fontWeight: 500, fontSize: "clamp(38px,4.6vw,64px)", lineHeight: 1.02, letterSpacing: "-.022em", textWrap: "pretty" }}>
              You read the news. Oddzy tells you what the market thinks will happen next.
            </h1>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.5, color: "var(--od-ink2)", maxWidth: "46ch" }}>
              Click Market Finder on any news article and see the Oddzy markets that answer it, with live odds.
            </p>
            <InstallCta howHref="#how" />
          </div>
          <div style={{ position: "relative", minWidth: 0 }}>
            {globe.length > 0 && (
              <div aria-hidden style={{ position: "absolute", inset: "-12% -18% -12% 8%", opacity: 0.55, pointerEvents: "none" }}>
                <OdMiniGlobe countries={globe} focus={["376", "364"]} zoom={1.6} metric="vol" />
              </div>
            )}
            <div style={{ position: "relative" }}>
              <BrowserMock rows={rows} height={600} />
            </div>
          </div>
        </section>

        <OdExtSetup />

        <section id="how" style={{ paddingTop: 40, scrollMarginTop: 100 }}>
          <div className="sechead" style={{ marginBottom: 18 }}>
            <h2 style={{ flex: "none", fontSize: "clamp(28px,3vw,40px)" }}>How it works</h2>
            <span style={{ fontSize: 14, color: "var(--od-ink3)" }}>
              The same link between headlines and odds as the{" "}
              <Link href="/" style={{ color: "var(--od-brand)", fontWeight: 700 }}>
                World Map
              </Link>
              , on any site you read.
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 12 }}>
            <Step n="01" title="Read an article" body="Any news site, any story about a war, an election, a rate decision or the oil price.">
              <div style={{ height: 200, borderRadius: 12, background: "#fbfaf7", padding: 16, display: "grid", gap: 9, alignContent: "start", overflow: "hidden" }}>
                <span style={{ fontWeight: 700, fontSize: 10, letterSpacing: ".08em", color: "#b3261e" }}>MIDDLE EAST</span>
                <span className="serif" style={{ fontWeight: 500, fontSize: 19, lineHeight: 1.15, color: "#161616" }}>
                  Israel and Iran trade strikes as ceasefire talks stall
                </span>
                {[94, 86, 70].map((w) => (
                  <span key={w} style={{ height: 7, borderRadius: 4, background: "#e6e3dc", width: `${w}%` }} />
                ))}
              </div>
            </Step>
            <Step n="02" title="Click Market Finder" body="Open it from your toolbar and press Scan. It reads that one page and nothing else.">
              <div style={{ height: 200, borderRadius: 12, background: "var(--od-bg)", border: "1px solid var(--od-line2)", display: "grid", alignContent: "start", overflow: "hidden" }}>
                <div style={{ height: 40, display: "flex", alignItems: "center", gap: 10, padding: "0 12px", borderBottom: "1px solid var(--od-line2)" }}>
                  <span style={{ flex: 1, height: 22, borderRadius: 999, background: "var(--od-chip)" }} />
                  <span style={{ width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", boxShadow: "0 0 0 2px var(--od-brand)", background: "var(--od-upBg)" }}>
                    <span style={{ width: 17, height: 17, borderRadius: 5, background: "linear-gradient(140deg,#2fe0a0,#0c9f8e)" }} />
                  </span>
                </div>
                <div style={{ margin: "12px 12px 0 auto", width: 210, borderRadius: 10, border: "1px solid var(--od-line)", background: "var(--od-panel)", padding: 12, display: "grid", gap: 10 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800 }}>Market Finder</span>
                  <span style={{ fontSize: 11.5, color: "var(--od-ink3)" }}>Nothing is read until you click Scan.</span>
                  <span style={{ height: 32, borderRadius: 8, background: "var(--od-brand)", color: "var(--od-brandInk)", fontSize: 13, fontWeight: 800, display: "grid", placeItems: "center" }}>Scan</span>
                </div>
              </div>
            </Step>
            <Step n="03" title="See the odds and trade" body="Each match shows how closely it fits the story and the live YES odds. Trade opens the market on oddzy.xyz.">
              <div style={{ height: 200, borderRadius: 12, background: "var(--od-bg)", border: "1px solid var(--od-line2)", padding: 12, display: "grid", gap: 8, alignContent: "start", overflow: "hidden" }}>
                {rows.slice(0, 2).map((r) => (
                  <div key={r.id} style={{ display: "grid", gap: 6, padding: 10, borderRadius: 10, background: "var(--od-panel)", border: "1px solid var(--od-line2)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="mono" style={{ height: 20, padding: "0 7px", borderRadius: 999, background: "var(--od-upBg)", color: "var(--od-up)", fontWeight: 700, fontSize: 10.5, lineHeight: "20px", whiteSpace: "nowrap", flex: "none" }}>
                        {r.match}% match
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{r.q}</span>
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <b className="mono" style={{ fontWeight: 700, fontSize: 18 }}>
                        {pct(r.p)}%
                      </b>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--od-up)" }}>YES</span>
                      <span style={{ marginInlineStart: "auto", height: 24, padding: "0 10px", borderRadius: 7, background: "var(--od-ink)", color: "var(--od-bg)", fontSize: 11.5, fontWeight: 700, display: "grid", placeItems: "center" }}>Trade</span>
                    </span>
                  </div>
                ))}
              </div>
            </Step>
          </div>
        </section>

        <section className="od-ext-2">
          <div style={{ borderTop: "3px solid var(--od-ink)", paddingTop: 14, display: "grid", gap: 10 }}>
            <h2 className="serif" style={{ margin: 0, fontWeight: 500, fontSize: "clamp(28px,3vw,40px)", lineHeight: 1.1 }}>
              Private by default
            </h2>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--od-ink2)", maxWidth: "40ch" }}>
              Market Finder only sees what you ask it to.{" "}
              <Link href="/privacy" style={{ color: "var(--od-brand)", fontWeight: 600 }}>
                Privacy policy
              </Link>
            </p>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 1, background: "var(--od-line)", border: "1px solid var(--od-line)", borderRadius: 16, overflow: "hidden" }}>
            {PRIVACY.map(([t, d]) => (
              <li key={t} style={{ display: "grid", gap: 6, alignContent: "start", padding: 18, background: "var(--od-panel)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--od-brand)", flex: "none" }} />
                  <b style={{ fontSize: 15.5 }}>{t}</b>
                </span>
                <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--od-ink2)" }}>{d}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="od-ext-2">
          <div style={{ borderTop: "3px solid var(--od-ink)", paddingTop: 14 }}>
            <h2 className="serif" style={{ margin: 0, fontWeight: 500, fontSize: "clamp(28px,3vw,40px)", lineHeight: 1.1 }}>
              Questions
            </h2>
          </div>
          <div style={{ borderTop: "1px solid var(--od-line)" }}>
            {FAQ.map(([q, a]) => (
              <details key={q} style={{ borderBottom: "1px solid var(--od-line)" }}>
                <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "18px 0", fontSize: 16.5, fontWeight: 700 }}>
                  {q}
                  <span aria-hidden className="mono od-plus" style={{ flex: "none", fontWeight: 500, fontSize: 18, color: "var(--od-ink3)" }}>
                    +
                  </span>
                </summary>
                <p style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.6, color: "var(--od-ink2)", maxWidth: "64ch" }}>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="od-ext-cta" style={{ marginTop: 64, padding: "clamp(24px,4vw,44px)", borderRadius: 20, background: "var(--od-panel)", border: "1px solid var(--od-line)" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <h2 className="serif" style={{ margin: 0, fontWeight: 500, fontSize: "clamp(26px,3vw,38px)", lineHeight: 1.1, textWrap: "pretty" }}>
              Put the odds next to the headlines.
            </h2>
            <p style={{ margin: 0, fontSize: 15, color: "var(--od-ink2)" }}>Market Finder is free and takes a minute to set up.</p>
          </div>
          <InstallCta secondary={false} />
        </section>
      </div>
    </SiteChrome>
  );
}

function Step({ n, title, body, children }: { n: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 14, alignContent: "start", padding: 18, borderRadius: 16, background: "var(--od-panel)", border: "1px solid var(--od-line2)" }}>
      {children}
      <span style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
        <b className="mono" style={{ fontWeight: 700, fontSize: 13, color: "var(--od-ink3)" }}>
          {n}
        </b>
        <span className="serif" style={{ fontWeight: 500, fontSize: 22, lineHeight: 1.2 }}>
          {title}
        </span>
      </span>
      <span style={{ fontSize: 14, lineHeight: 1.5, color: "var(--od-ink2)" }}>{body}</span>
    </div>
  );
}
