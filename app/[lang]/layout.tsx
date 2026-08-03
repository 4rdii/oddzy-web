import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Space_Grotesk, IBM_Plex_Mono, Vazirmatn } from "next/font/google";
import "../globals.css";
import { ThemeScript } from "@/components/ThemeScript";
import { brandFor, isLocale, LOCALES } from "@/lib/i18n";
import { getDict } from "@/lib/dict";

const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/**
 * Space Grotesk and IBM Plex Mono ship latin glyphs only — Persian text in them
 * falls through to whatever `system-ui` resolves to, which is inconsistent and
 * usually ugly. Vazirmatn covers arabic + latin, so it can carry the whole FA
 * UI including embedded latin words like "Polymarket" and "USDC".
 *
 * Both font objects are instantiated at module scope (next/font requires it),
 * but only the active locale's `variable` classes are applied to <html>, so the
 * browser only ever downloads the faces the rendered brand actually references.
 */
const vazirmatn = Vazirmatn({
  variable: "--font-vazir",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const brand = brandFor(lang);
  const t = getDict(lang);

  return {
    metadataBase: new URL(brand.siteUrl),
    title: {
      default: t.home.metaTitle,
      template: `%s · ${brand.name}`,
    },
    description: t.home.metaDescription,
    openGraph: {
      type: "website",
      siteName: brand.name,
      url: brand.siteUrl,
      locale: lang === "fa" ? "fa_IR" : "en_US",
    },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
    alternates: { canonical: brand.siteUrl },
  };
}

export default async function LangLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ lang: string }> }>) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const brand = brandFor(lang);
  // FA deliberately omits Plex Mono: PolyBaaz renders figures in the system mono
  // stack, so shipping it would be an unused download.
  const fontVars =
    lang === "fa"
      ? vazirmatn.variable
      : `${grotesk.variable} ${plexMono.variable}`;

  return (
    <html
      lang={brand.htmlLang}
      dir={brand.dir}
      data-locale={lang}
      className={`${fontVars} h-full`}
    >
      <head>
        <ThemeScript defaultTheme={lang === "fa" ? "night" : undefined} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
