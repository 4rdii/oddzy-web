"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { BRANDS } from "@/lib/i18n";
import { botLink } from "@/lib/telegram";
import { fa } from "@/lib/pb";

/**
 * The single conversion step (PbPredictSheet): outcome + current odds, an
 * amount, the payout, then "predict on the web" or the Telegram bot.
 *
 * Any button on a page opens it through usePredict(); the provider owns the one
 * sheet so pages stay server components with small client islands.
 */

export type PredictPick = {
  /** The question, e.g. «اسپانیا و کرواسی: برد اسپانیا؟». */
  title: string;
  /** Context line above it (league · date). */
  sub?: string;
  /** «برد اسپانیا» / «بله» / «خیر · بدون تغییر». */
  outcome: string;
  /** Whole percent 1–99 for the side being bought. */
  prob: number;
  /** The market to open in the app. */
  slug: string;
};

const PredictCtx = createContext<(p: PredictPick) => void>(() => {});

export const usePredict = () => useContext(PredictCtx);

export function PredictProvider({ children }: { children: ReactNode }) {
  const [pick, setPick] = useState<PredictPick | null>(null);
  const open = useCallback((p: PredictPick) => setPick(p), []);
  return (
    <PredictCtx.Provider value={open}>
      {children}
      {pick && <PredictSheet pick={pick} onClose={() => setPick(null)} />}
    </PredictCtx.Provider>
  );
}

export const PRESETS = [5, 10, 25, 100];

/** Payout per the handoff: amount × 100 / prob. */
export function payout(amount: number, prob: number) {
  const p = Math.max(1, prob);
  return { pay: (amount * 100) / p, mult: 100 / p };
}

export function Presets({ amt, setAmt, small }: { amt: number; setAmt: (v: number) => void; small?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: small ? 6 : 8 }}>
      {PRESETS.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => setAmt(v)}
          style={{
            padding: small ? "9px 2px" : "10px 4px",
            borderRadius: small ? 10 : 11,
            border: `1px solid ${v === amt ? "var(--goldline)" : "var(--line)"}`,
            background: v === amt ? "var(--goldbg)" : "var(--bg2)",
            color: v === amt ? "var(--gold)" : "var(--text)",
            fontWeight: 700,
            fontSize: small ? 12.5 : 14,
            cursor: "pointer",
          }}
        >
          {fa(v)} دلار
        </button>
      ))}
    </div>
  );
}

const TG_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="#229ED9" aria-hidden>
    <path d="M21.9 3.3 18.6 19c-.25 1.1-.9 1.37-1.82.85l-5.03-3.7-2.43 2.33c-.27.27-.5.5-1.01.5l.36-5.12 9.32-8.42c.4-.36-.09-.56-.63-.2L5.84 12.5.88 10.95c-1.08-.34-1.1-1.08.23-1.6L20.5 1.87c.9-.33 1.69.2 1.4 1.43Z" />
  </svg>
);

/** Gold "predict on the web" + the small Telegram pill under it. */
export function PredictCtas({ slug }: { slug: string }) {
  const pill: CSSProperties = {
    alignSelf: "center",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    background: "rgba(34,158,217,.12)",
    border: "1px solid rgba(34,158,217,.35)",
    color: "#229ED9",
    fontWeight: 700,
    fontSize: 13,
    padding: "8px 16px",
    borderRadius: 999,
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Link
        href={`/app?market=${encodeURIComponent(slug)}`}
        className="pb-gold-btn"
        style={{
          display: "block",
          textAlign: "center",
          fontWeight: 900,
          fontSize: 17,
          padding: 16,
          borderRadius: 16,
          boxShadow: "0 10px 26px -12px var(--gold)",
        }}
      >
        پیش‌بینی در وب
      </Link>
      <a href={botLink(undefined, BRANDS.fa.tgBot)} style={pill}>
        {TG_ICON}یا در ربات تلگرام
      </a>
    </div>
  );
}

function PredictSheet({ pick, onClose }: { pick: PredictPick; onClose: () => void }) {
  const [amt, setAmt] = useState(25);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  const { pay, mult } = payout(amt, pick.prob);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "var(--scrim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
    >
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label={pick.title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          maxHeight: "calc(100dvh - 32px)",
          overflowY: "auto",
          margin: "auto",
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 22,
          padding: "18px 18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          animation: "pbup .22s ease-out",
          color: "var(--text)",
          boxShadow: "0 -20px 60px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            {pick.sub && <div style={{ fontSize: 12, color: "var(--muted)" }}>{pick.sub}</div>}
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.65, textWrap: "pretty" }}>{pick.title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            style={{
              width: 32,
              height: 32,
              flexShrink: 0,
              borderRadius: "50%",
              border: "1px solid var(--line)",
              background: "var(--bg2)",
              color: "var(--muted)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            ✕
          </button>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            background: "var(--goldbg)",
            border: "1px solid var(--goldline)",
            borderRadius: 14,
            padding: "12px 14px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>پیش‌بینی شما</span>
            <span style={{ fontSize: 16, fontWeight: 800 }}>{pick.outcome}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>احتمال فعلی</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: "var(--gold)" }}>{fa(Math.round(pick.prob))}٪</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>مبلغ</span>
          <Presets amt={amt} setAmt={setAmt} />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 12,
            borderTop: "1px dashed var(--line2)",
            paddingTop: 14,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>اگر درست دربیاید دریافت می‌کنید</span>
            <span style={{ fontSize: 24, fontWeight: 800 }}>{fa(pay.toFixed(2))} دلار</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end", fontSize: 12, color: "var(--muted)" }}>
            <span>
              ضریب <b style={{ color: "var(--text)" }}>×{fa(mult.toFixed(2))}</b>
            </span>
            <span>
              سود <b style={{ color: "var(--up)" }}>{fa((pay - amt).toFixed(2))} دلار</b>
            </span>
          </div>
        </div>
        <PredictCtas slug={pick.slug} />
        <div style={{ fontSize: 11, color: "var(--faint)", textAlign: "center", lineHeight: 1.8 }}>
          قیمت نهایی، قیمت لحظهٔ ثبت سفارش است. پیش‌بینی با ریسک از دست دادن سرمایه همراه است.
        </div>
      </div>
    </div>
  );
}

/** A client button that opens the sheet — lets server-rendered lists stay server components. */
export function PredictButton({
  pick,
  style,
  className,
  children,
}: {
  pick: PredictPick;
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
}) {
  const open = usePredict();
  return (
    <button type="button" onClick={() => open(pick)} style={{ cursor: "pointer", ...style }} className={className}>
      {children}
    </button>
  );
}

/** The green «بله» / neutral «خیر» pair used on topic, question and match rows. */
export function YesNo({
  title,
  sub,
  slug,
  p,
  prefix,
  showPct = true,
  compact,
}: {
  title: string;
  sub?: string;
  slug: string;
  /** Whole percent for YES, or null. */
  p: number | null;
  /** Prepended to the outcome in the sheet, e.g. «بدون تغییر». */
  prefix?: string;
  showPct?: boolean;
  compact?: boolean;
}) {
  const y = p ?? 50;
  const base: CSSProperties = {
    minWidth: compact ? undefined : 84,
    padding: compact ? "7px 12px" : "9px 12px",
    borderRadius: compact ? 10 : 11,
    fontWeight: 800,
    fontSize: compact ? 12.5 : 13.5,
  };
  const out = (w: string) => (prefix ? `${w} · ${prefix}` : w);
  return (
    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
      <PredictButton
        pick={{ title, sub, slug, outcome: out("بله"), prob: y }}
        className="pb-yes"
        style={{ ...base, border: "1px solid transparent", background: "var(--upbg)", color: "var(--up)" }}
      >
        بله{showPct && p !== null ? ` ${fa(y)}٪` : ""}
      </PredictButton>
      <PredictButton
        pick={{ title, sub, slug, outcome: out("خیر"), prob: 100 - y }}
        className="pb-no"
        style={{ ...base, border: "1px solid var(--line)", background: "var(--bg2)", color: "var(--text2)" }}
      >
        خیر{showPct && p !== null ? ` ${fa(100 - y)}٪` : ""}
      </PredictButton>
    </div>
  );
}
