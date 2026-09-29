import type { SideKey, WhaleBet, WhaleGame, WhaleStats } from "@/lib/api";
import { fa, pc } from "@/lib/pb";

/** Tier label + colour, per the handoff (80+ sharp … under 40 below average; «new» is provisional). */
export function tierOf(s: WhaleStats | null): { label: string; c: string } {
  if (!s || s.score === null) return { label: "بدون سابقه", c: "var(--faint)" };
  switch (s.tier) {
    case "new":
      return { label: "تازه‌وارد", c: "var(--blue)" };
    case "sharp":
      return { label: "تیزبین", c: "var(--up)" };
    case "above_average":
      return { label: "بالاتر از میانگین", c: "var(--above)" };
    case "average":
      return { label: "میانگین", c: "var(--muted)" };
    default:
      return { label: "پایین‌تر از میانگین", c: "var(--down)" };
  }
}

/** Handoff tags: sharp (70+) on an outsider, big money with a weak record, a fresh account. */
export function tagOf(b: WhaleBet): { label: string; c: string; bg: string } | null {
  // A curated football sharp outranks every other tag: it is the strongest
  // signal we have, from a sport-specific record rather than all-market PnL.
  if (b.sharp) {
    return { label: `تیزبین فوتبال · بازده ${fa(Math.round(b.sharp.roi * 100))}٪ در ${fa(b.sharp.events)} بازی`, c: "var(--up)", bg: "var(--upbg)" };
  }
  const s = b.stats;
  if (!s || s.score === null) return null;
  const isNew = s.tier === "new";
  const entry = Math.round(b.avg_price * 100);
  if (!isNew && s.score >= 70 && entry <= 30) return { label: "تیزبین، روی کم‌شانس", c: "var(--up)", bg: "var(--upbg)" };
  if (!isNew && s.score < 40 && b.amount_usdc >= 15000) return { label: "پول زیاد، سابقهٔ ضعیف", c: "var(--down)", bg: "var(--downbg)" };
  if (isNew) return { label: "حساب تازه", c: "var(--blue)", bg: "var(--bluebg)" };
  return null;
}

export function whaleName(b: WhaleBet): string {
  return b.name || b.pseudonym || `${b.wallet.slice(0, 6)}…${b.wallet.slice(-3)}`;
}

const FA_OUTCOME: Record<string, string> = { Yes: "بله", No: "خیر", Over: "بالاتر", Under: "پایین‌تر" };

/** The side names of a game in Persian: home / draw / away. */
export function sideNames(g: Pick<WhaleGame, "result" | "teams" | "title" | "title_fa">): Record<SideKey, string> {
  const by = new Map((g.result?.sides ?? []).map((s) => [s.key, s]));
  const nm = (k: "home" | "away") =>
    by.get(k)?.label_fa ?? g.teams?.[k]?.name_fa ?? by.get(k)?.label ?? g.teams?.[k]?.name ?? (k === "home" ? "میزبان" : "میهمان");
  return { home: nm("home"), draw: "مساوی", away: nm("away") };
}

/** «برد اسپانیا» / «مساوی» for a result side. */
export function sideOutcome(k: SideKey, names: Record<SideKey, string>): string {
  return k === "draw" ? "مساوی" : `برد ${names[k]}`;
}

/** What the bet is on, in Persian — a result side, «نه برد X», or «پایین‌تر · گل‌ها ۳٫۵». */
export function betLabel(
  b: WhaleBet,
  names: Record<SideKey, string>,
  enNames?: Partial<Record<"home" | "away", string>>,
): string {
  if (b.side_key) return sideOutcome(b.side_key, names);
  if (b.against_key) return b.against_key === "draw" ? "مساوی نمی‌شود" : `نه ${sideOutcome(b.against_key, names)}`;
  const raw = b.market.title_fa ?? b.market.title ?? "";
  const q = raw.includes(": ") ? raw.slice(raw.indexOf(": ") + 2) : raw;
  // A handicap's side is a team named in English ("Croatia"); name it as the page does.
  const team = (["home", "away"] as const).find((k) => enNames?.[k] && enNames[k]!.toLowerCase() === b.outcome_label.toLowerCase());
  const out = team ? names[team] : FA_OUTCOME[b.outcome_label] ?? FA_OUTCOME[b.outcome] ?? b.outcome_label;
  return q ? `${out} · ${q}` : out;
}

/** Entry price as a percent. */
export function entryPct(b: WhaleBet): string {
  return `${fa(pc(b.avg_price) ?? 0)}٪`;
}

/** The score ring's dash for r=18 (circumference ≈ 113.1). */
export function ringDash(score: number | null): string {
  return `${(((score ?? 0) / 100) * 113.1).toFixed(1)} 200`;
}

/** English side names, to recognise a team named in an outcome label. */
export function enSideNames(g: Pick<WhaleGame, "result" | "teams">): Partial<Record<"home" | "away", string>> {
  const by = new Map((g.result?.sides ?? []).map((s) => [s.key, s.label]));
  return { home: by.get("home") ?? g.teams?.home?.name, away: by.get("away") ?? g.teams?.away?.name };
}
