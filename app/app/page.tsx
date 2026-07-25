import type { Metadata } from "next";
import { MiniApp } from "@/components/app/MiniApp";
import { getMarkets, getSections } from "@/lib/api";

export const metadata: Metadata = {
  title: "Markets",
  // The trading surface has no SEO value and shouldn't compete with the
  // marketing pages for the same queries — the blog and home carry that.
  robots: { index: false, follow: false },
};

// The upstream snapshot moves every ~30 min; revalidate well inside it.
export const revalidate = 300;

export default async function AppPage() {
  // Server-render the first paint so the feed has markets before hydration —
  // inside Telegram this is a cold webview on mobile data.
  const [sections, snapshot] = await Promise.all([
    getSections().catch(() => []),
    getMarkets({ limit: 40 }).catch(() => ({ markets: [] as never[] })),
  ]);

  return <MiniApp sections={sections} initialMarkets={snapshot.markets} />;
}
