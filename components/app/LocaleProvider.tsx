"use client";

import { createContext, useContext } from "react";
import type { Locale, Brand } from "@/lib/i18n";
import type { Dict } from "@/lib/dict/en";

/**
 * Carries locale, brand and copy into the trading UI.
 *
 * Everything under /app is a client component, so it cannot call `headers()` or
 * import the server-only dictionary module. The server page resolves all three
 * once and hands them down; the dictionary is plain serializable data, so it
 * crosses the RSC boundary as a prop with no extra fetch.
 *
 * Deliberately not a hook over `useParams()`: the locale must be identical to
 * the one the server rendered with, and reading it from the resolved layout
 * value guarantees that.
 */
export type LocaleContextValue = {
  locale: Locale;
  brand: Brand;
  t: Dict;
  /** true when the active locale renders right-to-left. */
  rtl: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  value,
  children,
}: {
  value: LocaleContextValue;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used inside <LocaleProvider>");
  }
  return ctx;
}

/**
 * Persian-Indic digits for figures that read as part of Persian prose
 * (percentages, counts, dates). Currency amounts deliberately stay in latin
 * digits — the design keeps "$248.60" as an LTR island, and mixing digit sets
 * inside one amount is worse than either alone.
 */
export function localizeDigits(input: string | number, locale: Locale): string {
  const s = String(input);
  if (locale !== "fa") return s;
  const FA = "۰۱۲۳۴۵۶۷۸۹";
  return s.replace(/\d/g, (d) => FA[Number(d)]);
}
