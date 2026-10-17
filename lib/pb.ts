/**
 * Formatting for the PolyBaaz content-page redesign (design/polybaaz_pages_redesign).
 *
 * The handoff writes every number in Persian digits and money as words
 * ("۱۷۰ هزار دلار") rather than "$170K": a "$" inside RTL text reorders against
 * its neighbours, and words sidestep the bidi problem entirely.
 */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Latin digits → Persian, "," → "٬", "." → "٫". */
export function fa(v: string | number): string {
  return String(v)
    .replace(/\d/g, (d) => FA_DIGITS[Number(d)])
    .replace(/,/g, "٬")
    .replace(/\./g, "٫");
}

/** Digits only → Persian, leaving punctuation alone (for sentences, where "." ends a line). */
export function faDigits(v: string): string {
  return v.replace(/\d/g, (d) => FA_DIGITS[Number(d)]).replace(/(\d|[۰-۹])%/g, "$1٪");
}

/** A 0–1 probability as a whole percent, 0–100. */
export function pc(p: number | null | undefined): number | null {
  if (p === null || p === undefined || !Number.isFinite(p)) return null;
  return Math.round(p * 100);
}

/** "۸۱٪", or "—" when unknown. */
export function faPct(p: number | null | undefined): string {
  const v = pc(p);
  return v === null ? "—" : `${fa(v)}٪`;
}

/** "۱٫۲ میلیون دلار" / "۱۷۰ هزار دلار" / "۸٬۵۰۰ دلار". */
export function faMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e6) return `${fa((a / 1e6).toFixed(1))} میلیون دلار`;
  if (a >= 1e4) return `${fa(Math.round(a / 1e3))} هزار دلار`;
  return `${fa(Math.round(a).toLocaleString("en-US"))} دلار`;
}

/** "حجم ۱۷۰ هزار دلار", or "" for no volume. */
export function faVol(n: number | null | undefined): string {
  return n ? `حجم ${faMoney(n)}` : "";
}

const TZ = "Asia/Tehran";

/** "۲۲:۱۵" in Tehran. */
export function faTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
}

/** "سه‌شنبه ۲۹ سپتامبر" in Tehran, Gregorian (the site's convention for dates). */
export function faDay(iso: string): string {
  return new Date(iso).toLocaleDateString("fa-IR-u-ca-gregory", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
}

/** "۳۱ دسامبر" in Tehran, Gregorian — a close date without the weekday. */
export function faDayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("fa-IR-u-ca-gregory", { day: "numeric", month: "long", timeZone: TZ });
}

/** The design's verbal read of a 0–100 probability. */
export function probWord(p: number): string {
  return p >= 95 ? "تقریباً قطعی" : p >= 65 ? "محتمل" : p >= 35 ? "نامعلوم" : p >= 6 ? "بعید" : "بسیار بعید";
}

/** The Tehran calendar day of an instant, as YYYY-MM-DD — for grouping and "today". */
export function tehranDate(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
}

/** "۳ دقیقه پیش" / "۲ ساعت پیش" / "۴ روز پیش". */
export function faAgo(iso: string, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${fa(Math.max(1, m))} دقیقه پیش`;
  const h = Math.round(m / 60);
  if (h < 48) return `${fa(h)} ساعت پیش`;
  return `${fa(Math.round(h / 24))} روز پیش`;
}

/** A stable hue per string, for monogram crests and generated avatars. */
export function hueOf(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** Side colours: home red, draw grey, away blue (the whales page's convention). */
export const SIDE_COLOR = {
  home: { c: "var(--home)", bg: "var(--homebg)", line: "var(--homeline)" },
  draw: { c: "var(--muted)", bg: "var(--card2)", line: "var(--line2)" },
  away: { c: "var(--blue)", bg: "var(--bluebg)", line: "var(--blueline)" },
} as const;

/** The current time, for server components that bucket by it (kept out of render bodies). */
export function nowMs(): number {
  return Date.now();
}

/* ── Bilingual pb (Oddzy runs the PolyBaaz design in English, LTR) ──────────
   The FA helpers above stay exactly as they are; these take a `lang` and
   return the FA helper's output unchanged for "fa", so a component made
   bilingual renders byte-identical Persian. English: Latin digits, "$1.2M"
   money, and the viewer's own time zone (see useTimeZone in useNow.ts — the
   server renders UTC, the client re-renders in the local zone after
   hydration). */

export type PbLang = "fa" | "en";

/** Persian digits for fa, the number as-is (thousands-grouped when an integer ≥ 1,000) for en. */
export function num(lang: PbLang, v: string | number): string {
  if (lang === "fa") return fa(v);
  return typeof v === "number" && Number.isInteger(v) && Math.abs(v) >= 1_000 ? v.toLocaleString("en-US") : String(v);
}

/** "۸۱٪" / "81%" for a whole percent 0–100 (or "—"). */
export function pctOf(lang: PbLang, v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return lang === "fa" ? `${fa(v)}٪` : `${v}%`;
}

/** faPct for fa; "81%" for en (0–1 probability in). */
export function probPct(lang: PbLang, p: number | null | undefined): string {
  return lang === "fa" ? faPct(p) : pctOf(lang, pc(p));
}

/** faMoney for fa; "$1.2M" / "$170K" / "$8,500" for en. */
export function money(lang: PbLang, n: number | null | undefined): string {
  if (lang === "fa") return faMoney(n);
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e6) return `$${(a / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (a >= 1e4) return `$${Math.round(a / 1e3)}K`;
  return `$${Math.round(a).toLocaleString("en-US")}`;
}

/** faVol for fa; "$170K vol" for en; "" for no volume. */
export function volOf(lang: PbLang, n: number | null | undefined): string {
  if (lang === "fa") return faVol(n);
  return n ? `${money(lang, n)} vol` : "";
}

/** faTime for fa (Tehran); "9:15 PM" in `tz` for en. */
export function timeOf(lang: PbLang, iso: string, tz?: string): string {
  if (lang === "fa") return faTime(iso);
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz ?? "UTC" });
}

/** faDay for fa (Tehran); "Tuesday, Sep 29" in `tz` for en. */
export function dayOf(lang: PbLang, iso: string, tz?: string): string {
  if (lang === "fa") return faDay(iso);
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short", timeZone: tz ?? "UTC" });
}

/** faDayMonth for fa (Tehran); "Dec 31" in `tz` for en. */
export function dayMonthOf(lang: PbLang, iso: string, tz?: string): string {
  if (lang === "fa") return faDayMonth(iso);
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: tz ?? "UTC" });
}

/** The calendar day of an instant as YYYY-MM-DD: Tehran for fa, `tz` for en. */
export function dateKey(lang: PbLang, iso: string | Date, tz?: string): string {
  if (lang === "fa") return tehranDate(iso);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz ?? "UTC" }).format(new Date(iso));
}

/** faAgo for fa; "3 min ago" / "2 hr ago" / "4 days ago" for en. */
export function agoOf(lang: PbLang, iso: string, now = Date.now()): string {
  if (lang === "fa") return faAgo(iso, now);
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hr ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** probWord for fa; the English read of a 0–100 probability for en. */
export function probWordOf(lang: PbLang, p: number): string {
  if (lang === "fa") return probWord(p);
  return p >= 95 ? "Near certain" : p >= 65 ? "Likely" : p >= 35 ? "Toss-up" : p >= 6 ? "Unlikely" : "Very unlikely";
}

/** Digits in a sentence: Persian for fa, untouched for en. */
export function digitsOf(lang: PbLang, v: string): string {
  return lang === "fa" ? faDigits(v) : v;
}
