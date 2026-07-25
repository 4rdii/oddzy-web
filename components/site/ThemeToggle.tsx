"use client";

import { useEffect, useState } from "react";

/** Day/night toggle. Persists to localStorage; ThemeScript applies it pre-paint. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"day" | "night" | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("oz-theme");
    if (stored === "day" || stored === "night") {
      setTheme(stored);
      return;
    }
    // No stored choice — reflect what the media query is currently showing so
    // the icon isn't lying about which mode a click will leave you in.
    setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day");
  }, []);

  function toggle() {
    const next = theme === "night" ? "day" : "night";
    setTheme(next);
    localStorage.setItem("oz-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--btn)] text-[var(--mute)]"
      aria-label={theme === "night" ? "Switch to light theme" : "Switch to dark theme"}
    >
      {/* Render nothing until mounted: the server can't know the theme, and a
          guessed icon would flip on hydration. */}
      <span aria-hidden>{theme === null ? "" : theme === "night" ? "☀" : "☽"}</span>
    </button>
  );
}
