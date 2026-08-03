import "server-only";
import type { Locale } from "@/lib/i18n";
import { en, type Dict } from "./en";
import { fa } from "./fa";

const DICTS: Record<Locale, Dict> = { en, fa };

/**
 * Synchronous on purpose: both dictionaries are small and statically imported,
 * so the pages that use them stay statically renderable. A dynamic `import()`
 * per locale would buy nothing here and complicates the ISR path.
 */
export function getDict(locale: Locale): Dict {
  return DICTS[locale];
}

export type { Dict };
