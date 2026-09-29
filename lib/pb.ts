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
