"use client";

import { heavyRoute } from "@/lib/routes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { SUB_SECTION } from "@/lib/od";

/**
 * PolyBaaz header nav: three groups instead of seven flat links.
 *
 *   desktop (≥900px) — three buttons; each opens a panel of its pages (click, or
 *                      hover with a pointer). Esc / outside click closes.
 *   phone            — three tabs; a tab opens a bottom sheet of its pages, and
 *                      the group you are in shows its pages as a chip row so
 *                      switching (Football ↔ Basketball) stays one tap.
 *
 * Every link is in the server HTML (closed panels carry `hidden`, they are not
 * absent), so crawlers still reach every section from every page.
 */

type Item = { href: string; label: string; desc: string; icon: string };
type Group = { key: "sport" | "pol" | "tools"; label: string; icon: string; items: Item[] };

export const PB_GROUPS: Group[] = [
  {
    key: "sport",
    label: "ورزش",
    icon: "⚽",
    items: [
      { href: "/topic/football", label: "فوتبال", desc: "لیگ‌ها و بازی‌های امروز", icon: "⚽" },
      { href: "/topic/cups", label: "جام‌های حذفی", desc: "کوپا دل ری، جام حذفی آلمان، جام حذفی و جام کارابائو انگلیس", icon: "🏆" },
      { href: "/topic/nba", label: "بسکتبال", desc: "بازی‌های NBA و قهرمانی", icon: "🏀" },
      { href: "/big-games", label: "بازی‌های بزرگ", desc: "مهم‌ترین بازی‌ها و شرط نهنگ‌ها", icon: "🔥" },
      { href: "/live", label: "زنده", desc: "بازی‌هایی که همین حالا در جریان‌اند", icon: "🔴" },
      { href: "/topic/mma", label: "UFC", desc: "مبارزه‌های پیش‌رو", icon: "🥊" },
      { href: "/topic/tennis", label: "تنیس", desc: "مسابقه‌های ATP و WTA", icon: "🎾" },
    ],
  },
  {
    key: "pol",
    label: "سیاست و اقتصاد",
    icon: "🌍",
    items: [
      { href: "/world", label: "نقشهٔ جهان", desc: "بازارها روی کرهٔ زمین", icon: "🌍" },
      { href: "/topic/iran", label: "ایران", desc: "آتش‌بس، مذاکره و تنگهٔ هرمز", icon: "📍" },
      { href: "/topic/politics", label: "سیاست", desc: "انتخابات و رهبران جهان", icon: "🏛" },
      { href: "/topic/economy", label: "اقتصاد", desc: "نرخ بهره، نفت و تورم", icon: "📈" },
      { href: "/updown", label: "کریپتو: صعودی یا نزولی", desc: "بیت‌کوین در ۱۵ دقیقهٔ بعد", icon: "₿" },
    ],
  },
  {
    key: "tools",
    label: "سبدها و ابزار",
    icon: "🧺",
    items: [
      { href: "/baskets", label: "سبدها", desc: "چند پیش‌بینی در یک خرید", icon: "🧺" },
      { href: "/how-it-works", label: "آموزش کار با پلی‌باز", desc: "از واریز تا برداشت", icon: "📘" },
      { href: "/faq", label: "سؤال‌های رایج", desc: "جواب‌های کوتاه", icon: "❓" },
    ],
  },
];

/** Which group a path belongs to. */
function groupOf(path: string): Group["key"] | null {
  if (/^\/(world|updown)(\/|$)/.test(path)) return "pol";
  if (/^\/(baskets|creator|how-it-works|faq|learn)(\/|$)/.test(path)) return "tools";
  if (/^\/(big-games|live|match)(\/|$)/.test(path)) return "sport";
  const t = /^\/topic\/([^/]+)/.exec(path);
  if (t) {
    const slug = t[1]!;
    if (SUB_SECTION[slug] || slug === "iran" || slug.startsWith("crypto")) return "pol";
    return "sport";
  }
  return null;
}

const isOn = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

export function PbNav({ label, part }: { label: string; part: "desktop" | "phone" }) {
  const raw = usePathname() ?? "/";
  const path = raw.replace(/^\/fa(?=\/|$)/, "") || "/";
  const current = groupOf(path);
  const [open, setOpen] = useState<Group["key"] | null>(null);
  const [sheet, setSheet] = useState<Group["key"] | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const hoverT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const uid = useId();
  // Portals need document.body, which only exists after hydration.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Navigating closes everything (reset during render, not in an effect).
  const [seenPath, setSeenPath] = useState(path);
  if (seenPath !== path) {
    setSeenPath(path);
    setOpen(null);
    setSheet(null);
  }

  useEffect(() => {
    if (!open && !sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setSheet(null);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (open && root.current && !root.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, sheet]);

  // The sheet takes focus when it opens, and gives it back when it closes.
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (sheet) sheetRef.current?.querySelector<HTMLElement>("a")?.focus();
  }, [sheet]);

  const hover = (k: Group["key"] | null) => {
    clearTimeout(hoverT.current);
    hoverT.current = setTimeout(() => setOpen(k), k ? 120 : 220);
  };
  const fine = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const active = PB_GROUPS.find((g) => g.key === current);
  const sheetGroup = PB_GROUPS.find((g) => g.key === sheet);

  return (
    <>
      {/* Desktop: three groups with panels. */}
      {part === "desktop" && (
      <div ref={root} className="hidden items-center gap-1 min-[900px]:flex" role="navigation" aria-label={label}>
        {PB_GROUPS.map((g) => {
          const isOpen = open === g.key;
          const on = current === g.key;
          const panelId = `${uid}-${g.key}`;
          return (
            <div
              key={g.key}
              className="relative"
              onMouseEnter={() => fine() && hover(g.key)}
              onMouseLeave={() => fine() && hover(null)}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : g.key)}
                style={{ fontSize: 14 }}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-[7px] font-semibold ${
                  on || isOpen
                    ? "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
                    : "text-[var(--mute)] hover:text-[var(--ink)]"
                }`}
              >
                <span aria-hidden>{g.icon}</span>
                {g.label}
                <span aria-hidden className={`text-[10px] transition-transform ${isOpen ? "rotate-180" : ""}`}>
                  ▾
                </span>
              </button>
              <div
                id={panelId}
                hidden={!isOpen}
                className="absolute top-full z-50 mt-1.5 w-[300px] rounded-2xl border border-[var(--line)] bg-[var(--card)] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.25)] [inset-inline-start:0]"
              >
                <ul className="flex flex-col">
                  {g.items.map((it) => (
                    <li key={it.href}>
                      <Link
                        prefetch={heavyRoute(it.href) ? false : undefined}
                        href={it.href}
                        aria-current={isOn(path, it.href) ? "page" : undefined}
                        className={`flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] ${
                          isOn(path, it.href) ? "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]" : ""
                        }`}
                      >
                        <span aria-hidden className="w-6 text-center" style={{ fontSize: 18 }}>
                          {it.icon}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="font-bold text-[var(--ink)]" style={{ fontSize: 14 }}>
                            {it.label}
                          </span>
                          <span className="text-[var(--mute)]" style={{ fontSize: 12.5 }}>
                            {it.desc}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      )}

      {/* Phone: three tabs, then the current group's pages as chips. */}
      {part === "phone" && (
      <div className="min-[900px]:hidden">
        <div className="grid grid-cols-3 gap-1.5 px-4 pb-2" role="navigation" aria-label={label}>
          {PB_GROUPS.map((g) => (
            <button
              key={g.key}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={sheet === g.key}
              onClick={() => setSheet(g.key)}
              style={{ fontSize: 13 }}
              className={`flex min-h-[44px] items-center justify-center gap-1 rounded-xl border px-2 font-bold ${
                current === g.key
                  ? "border-[color-mix(in_srgb,var(--accent)_32%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
                  : "border-[var(--line)] text-[var(--mute)]"
              }`}
            >
              <span className="truncate">{g.label}</span>
            </button>
          ))}
        </div>
        {active && (
          <nav className="pb-noscroll flex gap-1.5 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none]" aria-label={active.label} data-pb-chips>
            {active.items.map((it) => (
              <Link
                key={it.href}
                prefetch={heavyRoute(it.href) ? false : undefined}
                href={it.href}
                aria-current={isOn(path, it.href) ? "page" : undefined}
                style={{ fontSize: 13 }}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 font-semibold ${
                  isOn(path, it.href)
                    ? "border-[color-mix(in_srgb,var(--accent)_32%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
                    : "border-[var(--line)] text-[var(--mute)]"
                }`}
              >
                {it.icon} {it.label}
              </Link>
            ))}
          </nav>
        )}
      </div>

      )}

      {part === "phone" && sheetGroup && mounted && createPortal(
        <div className="fixed inset-0 z-[70] min-[900px]:hidden" dir="rtl" onClick={() => setSheet(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={sheetGroup.label}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-[var(--line)] bg-[var(--card)] px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--line)]" aria-hidden />
            <div className="mb-2 flex items-center justify-between">
              <span className="font-extrabold text-[var(--ink)]" style={{ fontSize: 16 }}>
                {sheetGroup.icon} {sheetGroup.label}
              </span>
              <button type="button" onClick={() => setSheet(null)} aria-label="بستن" className="h-9 w-9 rounded-lg border border-[var(--line)] text-[var(--mute)]">
                ✕
              </button>
            </div>
            <ul className="flex flex-col gap-1">
              {sheetGroup.items.map((it) => (
                <li key={it.href}>
                  <Link
                    prefetch={heavyRoute(it.href) ? false : undefined}
                    href={it.href}
                    onClick={() => setSheet(null)}
                    aria-current={isOn(path, it.href) ? "page" : undefined}
                    className={`flex min-h-[56px] items-center gap-3 rounded-2xl px-3 py-2 ${
                      isOn(path, it.href) ? "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]" : "bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
                    }`}
                  >
                    <span aria-hidden className="w-7 text-center" style={{ fontSize: 20 }}>
                      {it.icon}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-bold text-[var(--ink)]" style={{ fontSize: 15 }}>
                        {it.label}
                      </span>
                      <span className="text-[var(--mute)]" style={{ fontSize: 12.5 }}>
                        {it.desc}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
