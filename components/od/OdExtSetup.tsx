"use client";

import { useEffect, useState } from "react";

/**
 * "Installed. Three steps and you're set." — shown after the Add to Chrome
 * click (the od-install event) or on /extension?installed=1.
 */
export function OdExtSetup() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const show = () => {
      setOn(true);
      setTimeout(() => {
        const el = document.getElementById("setup");
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 120, behavior: "smooth" });
      }, 80);
    };
    if (new URLSearchParams(location.search).get("installed") === "1") setTimeout(show, 400);
    window.addEventListener("od-install", show);
    return () => window.removeEventListener("od-install", show);
  }, []);
  if (!on) return null;
  const steps = [
    ["1", "Pin it", "Click the puzzle icon in your toolbar, then the pin next to Market Finder."],
    ["2", "Open any article", "A news story about a war, an election, rates or oil."],
    ["3", "Click Scan", "Market Finder lists the markets that answer it."],
  ];
  return (
    <section id="setup" style={{ marginBottom: 24, padding: 20, borderRadius: 16, border: "1.5px solid var(--od-brand)", background: "var(--od-upBg)", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <h2 className="serif" style={{ margin: 0, fontWeight: 500, fontSize: 26, lineHeight: 1.1 }}>
          Installed? Three steps and you’re set.
        </h2>
        <button type="button" onClick={() => setOn(false)} style={{ border: 0, background: "transparent", color: "var(--od-ink2)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Dismiss
        </button>
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 10 }}>
        {steps.map(([n, t, d]) => (
          <li key={n} style={{ display: "flex", gap: 12, alignItems: "center", padding: 14, borderRadius: 12, background: "var(--od-panel)" }}>
            <b className="mono" style={{ flex: "none", width: 30, height: 30, borderRadius: "50%", background: "var(--od-ink)", color: "var(--od-bg)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13 }}>
              {n}
            </b>
            <span style={{ display: "grid", gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{t}</span>
              <span style={{ fontSize: 12.5, color: "var(--od-ink3)" }}>{d}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
