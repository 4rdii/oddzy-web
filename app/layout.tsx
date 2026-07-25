import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeScript } from "@/components/ThemeScript";

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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oddzy.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Oddzy — Prediction markets, in your pocket",
    template: "%s · Oddzy",
  },
  description:
    "Trade prediction markets on Polymarket from Telegram or the web. Self-custodial wallet, on-chain settlement, no bookmaker margin.",
  openGraph: {
    type: "website",
    siteName: "Oddzy",
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${grotesk.variable} ${plexMono.variable} h-full`}>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
