"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { chg, chgCol, pct } from "@/lib/od";

/**
 * The Market Finder pitch pieces (design: OdBrowserMock, OdFinderPopup,
 * OdInstallCta). The popup shows real markets passed in by the page; the
 * article around it is a mock.
 */

/** Chrome Web Store listing. Set NEXT_PUBLIC_EXTENSION_URL once it is live. */
export const EXT_STORE_URL = process.env.NEXT_PUBLIC_EXTENSION_URL || "https://chromewebstore.google.com/search/Oddzy%20Market%20Finder";

export type FinderRow = { id: string; q: string; p: number; chg: number | null; url: string; codes: string; match: number };

function Mark({ size = 22, r = 7, ring = 9 }: { size?: number; r?: number; ring?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: r, background: "linear-gradient(140deg,#2fe0a0,#0c9f8e)", display: "grid", placeItems: "center", flex: "none" }}>
      <span style={{ width: ring, height: ring, borderRadius: "50%", border: "2.5px solid #062a20", borderTopColor: "transparent", transform: "rotate(35deg)" }} />
    </span>
  );
}

export function FinderPopup({ rows, initial = "results", site = "meridiannews.com/world/middle-east" }: { rows: FinderRow[]; initial?: "idle" | "scanning" | "results"; site?: string }) {
  const [st, setSt] = useState(initial);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);
  const run = () => {
    setSt("scanning");
    clearTimeout(t.current);
    t.current = setTimeout(() => setSt("results"), 1100);
  };
  return (
    <div
      style={{
        width: 360,
        background: "var(--od-panel)",
        color: "var(--od-ink)",
        border: "1px solid var(--od-line)",
        borderRadius: 14,
        boxShadow: "0 24px 60px rgba(0,0,0,.28),0 2px 6px rgba(0,0,0,.12)",
        overflow: "hidden",
        textAlign: "start",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", borderBottom: "1px solid var(--od-line2)" }}>
        <Mark />
        <span style={{ fontWeight: 800, fontSize: 14.5, letterSpacing: "-.01em" }}>Market Finder</span>
        <span className="mono" style={{ marginInlineStart: "auto", fontWeight: 600, fontSize: 10, letterSpacing: ".06em", color: "var(--od-ink3)" }}>
          ODDZY
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--od-chip)" }}>
        <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
          <span className="mono" style={{ fontWeight: 600, fontSize: 11.5, color: "var(--od-ink2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {site}
          </span>
          <span style={{ fontSize: 11.5, color: "var(--od-ink3)" }}>{st === "results" ? "Scanned just now" : st === "scanning" ? "Reading this article…" : "Not scanned"}</span>
        </span>
        <button
          type="button"
          onClick={run}
          style={{
            flex: "none",
            height: 30,
            padding: "0 12px",
            borderRadius: 8,
            border: st === "idle" ? 0 : "1px solid var(--od-line)",
            background: st === "idle" ? "var(--od-brand)" : "transparent",
            color: st === "idle" ? "var(--od-brandInk)" : "var(--od-ink)",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {st === "results" ? "Rescan" : st === "scanning" ? "Scanning" : "Scan"}
        </button>
      </div>
      {st === "idle" && (
        <div style={{ padding: "28px 20px 30px", display: "grid", justifyItems: "center", gap: 10, textAlign: "center" }}>
          <span className="serif" style={{ fontWeight: 500, fontSize: 19, lineHeight: 1.25, maxWidth: "24ch" }}>
            Find the markets that answer this article.
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--od-ink3)", maxWidth: "30ch" }}>Nothing on this page is read until you click Scan.</span>
        </div>
      )}
      {st === "scanning" && (
        <div style={{ padding: 14, display: "grid", gap: 8 }}>
          {[1, 0.7, 0.45].map((o) => (
            <div key={o} style={{ height: 86, borderRadius: 11, background: "var(--od-line2)", opacity: o, animation: "odskel 1.1s ease-in-out infinite" }} />
          ))}
        </div>
      )}
      {st === "results" && (
        <>
          <div style={{ padding: "12px 14px 4px", fontSize: 12.5, color: "var(--od-ink3)" }}>
            {rows.length} market{rows.length === 1 ? "" : "s"} answer this story
          </div>
          <div style={{ padding: "0 10px 10px", display: "grid", gap: 6 }}>
            {rows.map((r) => (
              <div key={r.id} style={{ display: "grid", gap: 8, padding: "11px 12px", borderRadius: 11, border: "1px solid var(--od-line2)", background: "var(--od-bg)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    className="mono"
                    style={{
                      height: 22,
                      padding: "0 8px",
                      borderRadius: 999,
                      background: r.match >= 85 ? "var(--od-upBg)" : "var(--od-chip)",
                      color: r.match >= 85 ? "var(--od-up)" : "var(--od-ink2)",
                      fontWeight: 700,
                      fontSize: 11,
                      lineHeight: "22px",
                      whiteSpace: "nowrap",
                      flex: "none",
                    }}
                  >
                    {r.match}% match
                  </span>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 10.5, color: "var(--od-ink3)", whiteSpace: "nowrap" }}>
                    {r.codes}
                  </span>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{r.q}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <b className="mono" style={{ fontWeight: 700, fontSize: 22, lineHeight: 1, letterSpacing: "-.03em" }}>
                      {pct(r.p)}%
                    </b>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--od-up)" }}>YES</span>
                    <span className="mono" style={{ fontWeight: 700, fontSize: 11, color: chgCol(r.chg) }}>
                      {chg(r.chg)}
                    </span>
                  </span>
                  <Link
                    href={r.url}
                    style={{ marginInlineStart: "auto", height: 30, padding: "0 13px", borderRadius: 8, background: "var(--od-ink)", color: "var(--od-bg)", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center" }}
                  >
                    Trade
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderTop: "1px solid var(--od-line2)", fontSize: 11.5, color: "var(--od-ink3)" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--od-brand)", flex: "none" }} />
        <span style={{ flex: 1 }}>Private: reads a page only when you click Scan</span>
        <span style={{ fontWeight: 700, color: "var(--od-ink2)" }}>History</span>
      </div>
    </div>
  );
}

/** A 960px-wide browser window with a news article and the popup open, scaled to fit its column. */
export function BrowserMock({ rows, height = 600 }: { rows: FinderRow[]; height?: number }) {
  const outer = useRef<HTMLDivElement>(null);
  const [w, setW] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.getBoundingClientRect().width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  const k = w === null ? 1 : Math.min(1, w / 960);
  const shown = rows.slice(0, height >= 600 ? 3 : height >= 560 ? 2 : 1);
  return (
    <div ref={outer} style={{ width: "100%", height: Math.round(height * k), position: "relative", visibility: w === null ? "hidden" : "visible" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          insetInlineStart: 0,
          width: 960,
          height,
          transform: `scale(${k.toFixed(4)})`,
          transformOrigin: "top left",
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid var(--od-line)",
          background: "var(--od-panel2)",
          boxShadow: "0 30px 80px rgba(0,0,0,.25)",
        }}
      >
        <div style={{ height: 38, display: "flex", alignItems: "flex-end", gap: 12, padding: "0 14px", background: "var(--od-panel2)" }}>
          <span style={{ display: "flex", gap: 7, alignSelf: "center" }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#ff5f57" }} />
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#febc2e" }} />
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#28c840" }} />
          </span>
          <span style={{ height: 30, width: 260, borderRadius: "9px 9px 0 0", background: "var(--od-panel)", display: "flex", alignItems: "center", gap: 8, padding: "0 12px", fontSize: 12, color: "var(--od-ink2)", whiteSpace: "nowrap", overflow: "hidden" }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#b3261e", flex: "none" }} />
            Israel and Iran trade strikes as…
          </span>
        </div>
        <div style={{ height: 44, display: "flex", alignItems: "center", gap: 12, padding: "0 14px", background: "var(--od-panel)", borderBottom: "1px solid var(--od-line2)" }}>
          <span style={{ fontSize: 15, color: "var(--od-ink3)", letterSpacing: 6 }}>‹ ›</span>
          <span className="mono" style={{ flex: 1, height: 30, borderRadius: 999, background: "var(--od-chip)", display: "flex", alignItems: "center", padding: "0 14px", fontWeight: 500, fontSize: 12, color: "var(--od-ink2)" }}>
            meridiannews.com/world/middle-east/israel-iran-strikes
          </span>
          <span style={{ width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", color: "var(--od-ink3)" }}>
            <span style={{ width: 12, height: 12, border: "2px solid currentColor", borderRadius: 3 }} />
          </span>
          <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "var(--od-upBg)", boxShadow: "0 0 0 2px var(--od-brand)" }}>
            <Mark size={20} r={6} ring={8} />
          </span>
        </div>
        <div style={{ position: "relative", height: height - 82, background: "#fbfaf7", color: "#161616", overflow: "hidden" }}>
          <div style={{ padding: "22px 420px 0 48px", display: "grid", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 18, borderBottom: "2px solid #161616", paddingBottom: 10 }}>
              <span className="serif" style={{ fontWeight: 600, fontSize: 26, lineHeight: 1, letterSpacing: ".06em" }}>
                MERIDIAN
              </span>
              <span style={{ fontSize: 12, color: "#5a5a5a" }}>World · Middle East</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 11.5, letterSpacing: ".08em", textTransform: "uppercase", color: "#b3261e" }}>Middle East</span>
            <span
              className="serif"
              style={{
                fontWeight: 500,
                fontSize: 33,
                lineHeight: 1.1,
                letterSpacing: "-.01em",
                background: "linear-gradient(transparent 62%, rgba(34,197,139,.28) 62%)",
                boxDecorationBreak: "clone",
                WebkitBoxDecorationBreak: "clone",
              }}
            >
              Israel and Iran trade strikes as ceasefire talks stall
            </span>
            <span style={{ fontSize: 15, lineHeight: 1.5, color: "#3a3a3a" }}>Mediators say a new round of talks in Muscat is still on, but both sides have stepped up air defences.</span>
            <span style={{ fontSize: 12, color: "#6a6a6a" }}>By Staff Reporter</span>
            <div className="mono" style={{ height: 150, borderRadius: 4, background: "repeating-linear-gradient(135deg,#e7e4dc 0 10px,#efece5 10px 20px)", display: "grid", placeItems: "center", fontWeight: 500, fontSize: 11, color: "#8a8a8a" }}>
              article photo
            </div>
            <span style={{ fontSize: 14.5, lineHeight: 1.6, color: "#2a2a2a" }}>
              Israeli jets struck targets overnight after drones were intercepted over the Golan Heights, the military said. Iran’s foreign ministry called the strikes a violation of the truce.
            </span>
            <div style={{ display: "grid", gap: 9 }}>
              {[96, 88, 92, 60].map((x) => (
                <span key={x} style={{ height: 9, borderRadius: 5, background: "#e6e3dc", width: `${x}%` }} />
              ))}
            </div>
          </div>
          <div style={{ position: "absolute", top: 8, insetInlineEnd: 14, bottom: 8, display: "flex", alignItems: "flex-start" }}>
            <span style={{ position: "absolute", top: -7, insetInlineEnd: 24, width: 14, height: 14, background: "var(--od-panel)", borderTop: "1px solid var(--od-line)", borderInlineStart: "1px solid var(--od-line)", transform: "rotate(45deg)" }} />
            <FinderPopup rows={shown} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * "Add to Chrome — free" on desktop; on a phone, where extensions don't run,
 * a card that copies or shares the link for later.
 */
export function InstallCta({
  secondary = true,
  howHref = "/extension#how",
  note = "Free · Chrome, Edge and Brave on desktop",
  after = "event",
  align = "start",
}: {
  secondary?: boolean;
  howHref?: string;
  note?: string;
  /** "page": go to /extension's setup steps after the click; "event": tell the page (it shows them). */
  after?: "event" | "page";
  align?: "start" | "center";
}) {
  const [copied, setCopied] = useState(false);
  const canShare = useSyncExternalStore(
    () => () => {},
    () => !!navigator.share,
    () => false,
  );
  const install = () => {
    window.dispatchEvent(new CustomEvent("od-install"));
    if (after === "page") setTimeout(() => (location.href = "/extension?installed=1#setup"), 300);
  };
  return (
    <div style={{ display: "grid", gap: 10, justifyItems: align }}>
      <div className="od-install-desk" style={{ gap: 10, justifyItems: align }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: align }}>
          <a
            href={EXT_STORE_URL}
            target="_blank"
            rel="noopener"
            onClick={install}
            style={{ height: 48, padding: "0 20px", borderRadius: 12, background: "var(--od-brand)", color: "var(--od-brandInk)", fontWeight: 800, fontSize: 15.5, display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap" }}
          >
            <span style={{ width: 20, height: 20, borderRadius: "50%", background: "conic-gradient(#db4437 0 33%,#f4b400 0 66%,#0f9d58 0)", display: "grid", placeItems: "center", flex: "none" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4285f4", boxShadow: "0 0 0 2px #fff" }} />
            </span>
            Add to Chrome — free
          </a>
          {secondary && (
            <Link href={howHref} style={{ height: 48, padding: "0 18px", borderRadius: 12, border: "1px solid var(--od-line)", color: "var(--od-ink)", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
              How it works
            </Link>
          )}
        </div>
        <span style={{ fontSize: 12.5, color: "var(--od-ink3)" }}>{note}</span>
      </div>
      <div className="od-install-mob" style={{ gap: 10, width: "100%", maxWidth: 420, padding: 14, borderRadius: 14, border: "1px solid var(--od-line)", background: "var(--od-panel)" }}>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--od-ink)" }}>Available on desktop Chrome</span>
        <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--od-ink2)" }}>Save the link and install it on your computer. Works in Chrome, Edge and Brave.</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canShare && (
            <button
              type="button"
              onClick={() => navigator.share({ title: "Oddzy Market Finder", text: "Live odds next to the news you read", url: EXT_STORE_URL }).catch(() => {})}
              style={{ height: 40, padding: "0 14px", borderRadius: 10, border: 0, background: "var(--od-brand)", color: "var(--od-brandInk)", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
            >
              Send me the link
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(EXT_STORE_URL).catch(() => {});
              setCopied(true);
            }}
            style={{ height: 40, padding: "0 14px", borderRadius: 10, border: "1px solid var(--od-line)", background: "transparent", color: "var(--od-ink)", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}
