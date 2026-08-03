"use client";

import { createContext, useContext, useMemo } from "react";
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

/**
 * A count-dependent string. English picks by `n === 1`; locales without that
 * distinction (Persian among them) set both members to the same text, so no
 * caller ever has to know which rule applies.
 */
export type Plural = { one: string; other: string };

export type LocaleTools = LocaleContextValue & {
  /**
   * Substitute `{name}` placeholders in a dictionary string.
   *
   * The dictionary crosses the RSC boundary as a prop, so it can only hold
   * plain data — templates, never functions. Numbers are passed through
   * `localizeDigits`; strings (names, queries, addresses) go in verbatim.
   */
  tf: (template: string, vars: Record<string, string | number>) => string;
  /** Pick the plural form for `n`, then substitute its `{n}`. */
  tn: (forms: Plural, n: number) => string;
};

export function useLocale(): LocaleTools {
  const ctx = useContext(LocaleContext);
  const locale = ctx?.locale ?? "en";

  // Built before the guard below so the hook order is unconditional.
  const tools = useMemo(() => {
    const tf = (template: string, vars: Record<string, string | number>) =>
      template.replace(/\{(\w+)\}/g, (whole, key: string) => {
        const v = vars[key];
        if (v === undefined) return whole;
        return typeof v === "number" ? localizeDigits(v, locale) : v;
      });
    const tn = (forms: Plural, n: number) => tf(n === 1 ? forms.one : forms.other, { n });
    return { tf, tn };
  }, [locale]);

  if (!ctx) {
    throw new Error("useLocale must be used inside <LocaleProvider>");
  }
  return { ...ctx, ...tools };
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
