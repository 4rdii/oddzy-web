"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { SUB_SECTION, type OdTick, type SecKey } from "@/lib/od";

/**
 * The client pieces of OdHeader: the wire (clock + movers ticker), the nav's
 * current-page mark, and the theme switch. The rest of the header is static.
 */

export function OdWire() {
  const [clock, setClock] = useState("");
  const [data, setData] = useState<{ ticks: OdTick[]; traded: string } | null>(null);

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setClock(`${String(n.getUTCHours()).padStart(2, "0")}:${String(n.getUTCMinutes()).padStart(2, "0")}`);
    };
    tick();
    const t = setInterval(tick, 20_000);
    fetch("/api/od/ticker")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
    return () => clearInterval(t);
  }, []);

  const ticks = data?.ticks ?? [];
  return (
    <div className="od-wire">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          paddingInline: "clamp(12px,2.5vw,24px)",
          flex: "none",
          height: "100%",
          borderInlineEnd: "1px solid rgba(255,255,255,.12)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#ff6b6b", fontWeight: 700, letterSpacing: ".08em" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff5a5f", animation: "odpulse 1.6s ease-in-out infinite" }} />
          LIVE
        </span>
        <span style={{ whiteSpace: "nowrap", minWidth: 62 }}>{clock ? `${clock} UTC` : ""}</span>
        {data && (
          <span className="od-traded" style={{ color: "#8d9993", whiteSpace: "nowrap" }}>
            {data.traded} traded on Polymarket · 24h
          </span>
        )}
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          height: "100%",
          WebkitMaskImage: "linear-gradient(90deg,transparent,#000 24px,#000 calc(100% - 24px),transparent)",
          maskImage: "linear-gradient(90deg,transparent,#000 24px,#000 calc(100% - 24px),transparent)",
        }}
      >
        {ticks.length > 0 && (
          <div className="od-wire-tape">
            {[...ticks, ...ticks].map((t, i) => (
              <Link prefetch={false}
                key={i}
                href={t.url}
                aria-hidden={i >= ticks.length ? true : undefined}
                tabIndex={i >= ticks.length ? -1 : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  paddingInline: 18,
                  height: "100%",
                  whiteSpace: "nowrap",
                  borderInlineEnd: "1px solid rgba(255,255,255,.08)",
                  color: "#cfd8d3",
                }}
              >
                {t.codes && <span style={{ color: "#76827c" }}>{t.codes}</span>}
                <span>{t.short}</span>
                <b style={{ color: "#fff", fontWeight: 700 }}>{t.p}%</b>
                <span style={{ color: t.up ? "#3ddc97" : "#ff6b6b", fontWeight: 700 }}>{t.chg}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type NavItem = { key: string; label: string; href: string; sec?: boolean };

const NAV: NavItem[] = [
  { key: "home", label: "World Map", href: "/" },
  { key: "pol", label: "Politics", href: "/topic/politics" },
  { key: "eco", label: "Economy", href: "/topic/economy" },
  { key: "war", label: "War & Geopolitics", href: "/topic/world" },
  { key: "baskets", label: "Baskets", href: "/baskets" },
  { key: "learn", label: "Learn", href: "/learn" },
  { key: "sports", label: "Sports", href: "/live", sec: true },
];

/** Which nav item a path belongs to; `active` (a page's own say) wins. */
function activeOf(path: string): string | null {
  if (path === "/") return "home";
  const topic = /^\/topic\/([^/]+)/.exec(path);
  if (topic) return (SUB_SECTION[topic[1]] as SecKey | undefined) ?? "sports";
  if (path.startsWith("/baskets") || path.startsWith("/creator")) return "baskets";
  if (path.startsWith("/learn") || path.startsWith("/how-it-works") || path.startsWith("/faq")) return "learn";
  if (/^\/(live|big-games|match)(\/|$)/.test(path)) return "sports";
  return null;
}

export function OdNav({ active }: { active?: string }) {
  const raw = usePathname() ?? "/";
  const path = raw.replace(/^\/en(?=\/|$)/, "") || "/";
  const on = active ?? activeOf(path);

  useEffect(() => {
    // Phones: the nav is a scrolling row; keep the current item in view.
    document.querySelector<HTMLElement>('.od-nav [aria-current="page"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [on]);

  return (
    <nav aria-label="Main" className="od-nav noscroll">
      {NAV.map((n) => (
        <span key={n.key} style={{ display: "contents" }}>
          {n.sec && <span className="div" aria-hidden />}
          <Link href={n.href} prefetch={false} aria-current={n.key === on ? "page" : undefined} className={n.sec ? "sec" : undefined}>
            {n.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}

/** The theme lives on <html data-theme>; this mirrors it without an effect. */
function subscribeTheme(cb: () => void) {
  window.addEventListener("od-theme", cb);
  return () => window.removeEventListener("od-theme", cb);
}
const themeNow = () => (document.documentElement.getAttribute("data-theme") === "day" ? "day" : "night");

export function OdThemeButton() {
  const theme = useSyncExternalStore(subscribeTheme, themeNow, () => null);
  const toggle = () => {
    const next = theme === "day" ? "night" : "day";
    localStorage.setItem("oz-theme", next);
    document.documentElement.setAttribute("data-theme", next);
    window.dispatchEvent(new Event("od-theme"));
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "day" ? "Switch to dark mode" : "Switch to light mode"}
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        border: "1px solid var(--od-line)",
        background: "transparent",
        color: "var(--od-ink2)",
        fontSize: 15,
        cursor: "pointer",
      }}
    >
      <span aria-hidden>{theme === null ? "" : theme === "day" ? "☾" : "☀"}</span>
    </button>
  );
}
