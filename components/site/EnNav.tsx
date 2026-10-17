"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Oddzy's header nav in the PolyBaaz (pb) style: politics and economy first,
 * Sports last and visually secondary. Rendered twice by SiteChrome — a row
 * from 900px, a scrolling chip row below it — like PolyBaaz's FA_NAV.
 *
 * Client-side only to know the current page: SiteChrome is shared by ~20
 * routes that don't pass `active`. The pathname is the same on the server
 * render and the client ("/en/topic/x" locally is stripped to "/topic/x"), so
 * aria-current is in the static HTML and hydration agrees.
 */
export type EnNavItem = { href: string; label: string; secondary?: boolean; also?: string[] };

function isOn(path: string, it: EnNavItem): boolean {
  const hits = [it.href, ...(it.also ?? [])];
  return hits.some((h) => (h === "/" ? path === "/" : path === h || path.startsWith(`${h}/`)));
}

export function EnNav({ items, chip, label }: { items: EnNavItem[]; chip?: boolean; label: string }) {
  const raw = usePathname() ?? "/";
  const path = raw.replace(/^\/en(?=\/|$)/, "") || "/";

  useEffect(() => {
    if (!chip) return;
    document.querySelector<HTMLElement>('nav[data-en-chips] [aria-current="page"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [chip, path]);

  const tint = "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]";
  return (
    <nav
      aria-label={label}
      data-en-chips={chip ? "" : undefined}
      className={
        chip
          ? "pb-noscroll flex gap-1.5 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] min-[900px]:hidden"
          : "hidden items-center gap-0.5 min-[900px]:flex"
      }
    >
      {items.map((it) => {
        const on = isOn(path, it);
        const base = chip
          ? `shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-semibold`
          : `whitespace-nowrap rounded-[10px] px-3 py-[7px] text-[14px] font-medium`;
        const tone = on
          ? chip
            ? `border-[color-mix(in_srgb,var(--accent)_32%,transparent)] text-[var(--accent)] ${tint}`
            : `text-[var(--accent)] ${tint}`
          : it.secondary
            ? chip
              ? "border-dashed border-[var(--line)] text-[var(--faint)]"
              : "text-[var(--faint)] hover:text-[var(--ink)]"
            : chip
              ? "border-[var(--line)] text-[var(--mute)]"
              : "text-[var(--mute)] hover:text-[var(--ink)]";
        return (
          <span key={it.href} className={it.secondary ? (chip ? "ms-1.5 flex shrink-0" : "ms-2 flex items-center border-s border-[var(--line)] ps-2") : "contents"}>
            <Link href={it.href} aria-current={on ? "page" : undefined} className={`${base} ${tone}${it.secondary && !chip ? " text-[13px]" : ""}`}>
              {it.label}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
