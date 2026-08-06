/**
 * Locale + brand resolution.
 *
 * One deployment serves two brands off two hostnames:
 *   oddzy.xyz     -> en / Oddzy    (LTR)
 *   polybaaz.com  -> fa / PolyBaaz (RTL)
 *
 * The hostname is mapped to a `lang` path segment in `proxy.ts` (a rewrite, so
 * the segment never shows in the URL bar). Routing on the path rather than
 * reading the Host header inside components is deliberate: `app/[lang]/page.tsx`
 * and `app/[lang]/app/page.tsx` are ISR (`revalidate = 300`), and both hostnames
 * share one Vercel cache. Branching on the header would keep a single cache key
 * for both brands and could serve the English page to PolyBaaz visitors. A path
 * segment gives each brand its own key and keeps both statically rendered.
 */

export const LOCALES = ["en", "fa"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(v: string | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

/** Host -> locale. Matches apex, www, and any preview subdomain. */
export function localeForHost(host: string | null | undefined): Locale {
  if (!host) return DEFAULT_LOCALE;
  return host.toLowerCase().includes("polybaaz") ? "fa" : DEFAULT_LOCALE;
}

export type Brand = {
  /** Wordmark shown in the header, footer and receipts. */
  name: string;
  /**
   * Logo mark — the bot's actual Telegram avatar, served from /public.
   *
   * Was a single letter set in the UI font ("O" / "پ"). That is not the logo
   * anyone recognises: a user arriving from the bot saw a different mark on the
   * web than the one they tapped in Telegram. Both files are square app icons
   * with their own background baked in, so they carry their own contrast in
   * either theme and want a rounded-square frame, not a circular crop.
   */
  logo: string;
  /** Canonical origin — drives metadataBase, OG urls, sitemap and robots. */
  siteUrl: string;
  /** Telegram bot deep-linked from every "open in Telegram" affordance. */
  tgBot: string;
  dir: "ltr" | "rtl";
  /** BCP-47 tag for <html lang> and Intl formatting. */
  htmlLang: string;
};

export const BRANDS: Record<Locale, Brand> = {
  en: {
    name: "Oddzy",
    logo: "/logo-en.jpg",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://oddzy.xyz",
    tgBot: process.env.NEXT_PUBLIC_TG_BOT ?? "poly_sport_bet_bot",
    dir: "ltr",
    htmlLang: "en",
  },
  fa: {
    name: "پلی‌باز",
    logo: "/logo-fa.jpg",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL_FA ?? "https://polybaaz.com",
    tgBot: process.env.NEXT_PUBLIC_TG_BOT_FA ?? "PolyBaaz_Bot",
    dir: "rtl",
    htmlLang: "fa",
  },
};

export function brandFor(locale: Locale): Brand {
  return BRANDS[locale];
}
