"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { LocaleProvider, useLocale } from "@/components/app/LocaleProvider";
import { PRIVY_ENABLED, PrivyRoot } from "@/components/app/PrivyRoot";
import { WebLogin } from "@/components/app/WebLogin";
import { PositionsScreen, WalletScreen } from "@/components/app/AccountScreens";
import type { Market } from "@/lib/api";
import { ApiCallError, authedGet, authedPost } from "@/lib/client-api";
// The plain dictionary modules, not lib/dict (server-only): this file is a
// lazily loaded browser chunk, so carrying both dictionaries here costs pages nothing.
import { en, type Dict } from "@/lib/dict/en";
import { fa as faDict } from "@/lib/dict/fa";
import { localized } from "@/lib/format";
import { brandFor, type Locale } from "@/lib/i18n";
import { track } from "@/lib/track";
import { setMe, type TradeMsg, type TradeRequest, type TradeSide } from "@/lib/trade-bus";

/**
 * The website's trading runtime (loaded lazily by TradeHost): Privy, the
 * sign-in step and the trade / account modal. Same API and the same wallet
 * setup as /app — it is the desktop face of the same account, not a second one.
 */
export function TradeRuntime({ lang, pending, clear }: { lang: Locale; pending: TradeMsg | null; clear: () => void }) {
  const brand = brandFor(lang);
  const value = useMemo(() => ({ locale: lang, brand, t: lang === "fa" ? faDict : en, rtl: brand.dir === "rtl" }), [lang, brand]);
  return (
    <LocaleProvider value={value}>
      {PRIVY_ENABLED ? (
        <PrivyRoot>
          <Controller pending={pending} clear={clear} />
        </PrivyRoot>
      ) : (
        <NoPrivy pending={pending} clear={clear} />
      )}
    </LocaleProvider>
  );
}

// ---------------------------------------------------------------- look

type Pal = { bg: string; card: string; line: string; text: string; mute: string; accent: string; accentInk: string; up: string; down: string; upBg: string; downBg: string };
function palette(fa: boolean): Pal {
  const t = document.documentElement.getAttribute("data-theme");
  const light = t === "day" || (t !== "night" && !window.matchMedia("(prefers-color-scheme: dark)").matches);
  const accent = fa ? "#f3b53a" : "#22c58b";
  return light
    ? { bg: "#ffffff", card: "#f4f2ec", line: "rgba(20,20,20,.12)", text: "#16150f", mute: "#6b6a64", accent: fa ? "#d99a12" : "#0b8f5f", accentInk: "#ffffff", up: "#0b8f5f", down: "#c8323f", upBg: "rgba(11,143,95,.10)", downBg: "rgba(200,50,63,.10)" }
    : { bg: "#15181d", card: "#1d2129", line: "rgba(255,255,255,.10)", text: "#f2f3f5", mute: "#9a9fa8", accent, accentInk: "#0d0f12", up: "#22c58b", down: "#f0646e", upBg: "rgba(34,197,139,.12)", downBg: "rgba(240,100,110,.12)" };
}

function Modal({ children, onClose, pal, rtl, label }: { children: ReactNode; onClose: () => void; pal: Pal; rtl: boolean; label: string }) {
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
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(3px)" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        dir={rtl ? "rtl" : "ltr"}
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", width: "min(420px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: pal.bg, color: pal.text, border: `1px solid ${pal.line}`, borderRadius: 18, padding: 20, boxShadow: "0 30px 80px rgba(0,0,0,.45)" }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{ position: "absolute", top: 12, insetInlineEnd: 12, width: 32, height: 32, borderRadius: 9, border: `1px solid ${pal.line}`, background: "transparent", color: pal.mute, cursor: "pointer", fontSize: 14 }}
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

const money = (v: number | null | undefined, fa: boolean) => {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = v.toFixed(2);
  return fa ? `${s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]).replace(".", "٫")} دلار` : `$${s}`;
};
const faDigits = (s: string) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]).replace(".", "٫");
const qty = (v: number, fa: boolean) => (fa ? faDigits(v.toFixed(2)) : v.toFixed(2));
const cents = (p: number, fa: boolean) => {
  const c = Math.round(p * 100);
  return fa ? `${String(c).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d])}٪` : `${c}¢`;
};

// ---------------------------------------------------------------- controller

type Tab = "positions" | "wallet";
type View = { kind: "signin" } | { kind: "drawer"; tab: Tab } | { kind: "trade"; req: TradeRequest };

function Controller({ pending, clear }: { pending: TradeMsg | null; clear: () => void }) {
  const { t, locale, rtl } = useLocale();
  const fa = locale === "fa";
  const { ready, authenticated, logout } = usePrivy();
  const [view, setView] = useState<View | null>(null);
  const [account, setAccount] = useState<"unknown" | "ok" | "needed">("unknown");
  const [balance, setBalance] = useState<number | null>(null);
  // Re-read the theme each time a modal opens (the site toggle may have changed it).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pal = useMemo(() => palette(fa), [fa, view]);

  const refreshMe = useCallback(async () => {
    try {
      const d = await authedGet<{ balance: number }>("/webapp/v1/me");
      setBalance(d.balance);
      setAccount("ok");
      setMe({ state: "in", balance: d.balance });
    } catch {
      setAccount("needed");
      setMe({ state: "out" });
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors Privy's state into the header store
      setAccount("needed");
      setMe({ state: "out" });
      return;
    }
    void refreshMe();
  }, [ready, authenticated, refreshMe]);

  useEffect(() => {
    if (!pending) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a message from a page button opens the modal
    setView(pending.kind === "trade" ? { kind: "trade", req: pending.req } : pending.kind === "account" ? { kind: "drawer", tab: "positions" } : { kind: "signin" });
    clear();
  }, [pending, clear]);

  if (!view) return null;
  const close = () => setView(null);
  const needLogin = account === "needed" || (ready && !authenticated);
  const title = view.kind === "drawer" ? t.app.trade.account : t.app.trade.signInTitle;
  const signOut = () => {
    void logout().finally(() => {
      setMe({ state: "out" });
      setAccount("needed");
      close();
    });
  };
  // The portfolio drawer: the app's own Positions / Wallet screens, on the page.
  if (view.kind === "drawer" && ready && authenticated && account === "ok") {
    return (
      <Drawer
        tab={view.tab}
        setTab={(tab) => setView({ kind: "drawer", tab })}
        balance={balance}
        rtl={rtl}
        fa={fa}
        onClose={close}
        onSignOut={signOut}
        onOpenMarket={(slug) => setView({ kind: "trade", req: { slug } })}
      />
    );
  }

  let body: ReactNode;
  if (!ready || (authenticated && account === "unknown")) {
    body = <Spinner pal={pal} text={t.app.login.loading} />;
  } else if (needLogin) {
    body = (
      <>
        <h2 style={{ margin: "4px 40px 0 0", fontSize: 18, fontWeight: 800 }}>{title}</h2>
        <WebLogin
          compact
          onReady={() => {
            void refreshMe().then(() => {
              if (view.kind === "signin") close();
            });
          }}
        />
      </>
    );
  } else if (view.kind === "trade") {
    body = (
      <TradePanel
        req={view.req}
        balance={balance}
        pal={pal}
        onPlaced={refreshMe}
        onClose={close}
        onDrawer={(tab) => setView({ kind: "drawer", tab })}
      />
    );
  } else {
    body = <Spinner pal={pal} text={t.app.login.loading} />;
  }

  return (
    <Modal onClose={close} pal={pal} rtl={rtl} label={title}>
      {body}
    </Modal>
  );
}

function NoPrivy({ pending, clear }: { pending: TradeMsg | null; clear: () => void }) {
  const { t, locale, rtl } = useLocale();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!pending) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a message from a page button opens the modal
    setOpen(true);
    clear();
  }, [pending, clear]);
  if (!open) return null;
  return <NoPrivyModal fa={locale === "fa"} rtl={rtl} t={t} onClose={() => setOpen(false)} />;
}

function NoPrivyModal({ fa, rtl, t, onClose }: { fa: boolean; rtl: boolean; t: Dict; onClose: () => void }) {
  const pal = useMemo(() => palette(fa), [fa]);
  return (
    <Modal onClose={onClose} pal={pal} rtl={rtl} label={t.app.trade.openApp}>
      <p style={{ margin: "8px 40px 16px 0" }}>{t.app.trade.unavailable}</p>
      <Link prefetch={false} href="/app" style={btn(pal, true)}>{t.app.trade.openApp}</Link>
    </Modal>
  );
}

function Spinner({ pal, text }: { pal: Pal; text: string }) {
  return (
    <div style={{ minHeight: 220, display: "grid", placeItems: "center", alignContent: "center", gap: 12, color: pal.mute, fontSize: 14 }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${pal.line}`, borderTopColor: pal.accent, animation: "ozspin 0.8s linear infinite" }} />
      <style>{"@keyframes ozspin{to{transform:rotate(360deg)}}"}</style>
      {text}
    </div>
  );
}

const btn = (pal: Pal, primary: boolean, disabled = false): CSSProperties => ({
  display: "block",
  width: "100%",
  textAlign: "center",
  padding: "14px 16px",
  borderRadius: 14,
  border: primary ? 0 : `1px solid ${pal.line}`,
  background: primary ? pal.accent : "transparent",
  color: primary ? pal.accentInk : pal.text,
  fontWeight: 800,
  fontSize: 15.5,
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.55 : 1,
  textDecoration: "none",
});

// ---------------------------------------------------------------- trade

const PRESETS = [5, 10, 25, 50, 100];

function TradePanel({ req, balance, pal, onPlaced, onClose, onDrawer }: { req: TradeRequest; balance: number | null; pal: Pal; onPlaced: () => Promise<void>; onClose: () => void; onDrawer: (tab: Tab) => void }) {
  const { t, tf, locale } = useLocale();
  const fa = locale === "fa";
  const [market, setMarket] = useState<Market | null | "missing">(null);
  const [side, setSide] = useState<TradeSide>(req.side ?? "YES");
  const [amount, setAmount] = useState<number>(req.amount && req.amount > 0 ? req.amount : 10);
  const [quote, setQuote] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ shares: number; cost: number; avg: number } | null>(null);

  useEffect(() => {
    track("trade_open");
  }, [req.slug]);

  useEffect(() => {
    let dead = false;
    authedGet<Market>(`/webapp/v1/market?slug=${encodeURIComponent(req.slug)}`)
      .then((m) => !dead && setMarket(m))
      .catch(() => !dead && setMarket("missing"));
    return () => {
      dead = true;
    };
  }, [req.slug]);

  // Live executable price for the chosen side; the snapshot probability covers the gap.
  const seq = useRef(0);
  useEffect(() => {
    if (!market || market === "missing") return;
    const n = ++seq.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the old side's quote while the new one loads
    setQuote(null);
    authedGet<{ price: number }>(`/webapp/v1/quote?marketId=${encodeURIComponent(market.id)}&side=${side}`)
      .then((q) => n === seq.current && Number.isFinite(q.price) && setQuote(q.price))
      .catch(() => {});
  }, [market, side]);

  if (market === null) return <Spinner pal={pal} text={t.app.trade.loadingMarket} />;
  if (market === "missing" || market.status !== "active")
    return (
      <div style={{ padding: "24px 0 4px" }}>
        <p style={{ margin: "0 40px 18px 0" }}>{t.app.trade.marketMissing}</p>
        <button type="button" style={btn(pal, false)} onClick={onClose}>{t.app.trade.close}</button>
      </div>
    );

  // The API sends Polymarket's outcome names as a list: ["Yes","No"], or two
  // names on a head-to-head. The page's own label for the requested side wins.
  const labelOf = (s: TradeSide) => {
    if (req.label && s === (req.side ?? "YES")) return req.label;
    const list = Array.isArray(market.outcome_labels) ? (market.outcome_labels as unknown as string[]) : [];
    const own = list[s === "YES" ? 0 : 1];
    if (own && !/^(yes|no)$/i.test(own)) return own;
    return s === "YES" ? t.app.bet.yes : t.app.bet.no;
  };
  const title = req.title || localized(locale, market.title, market.title_fa);
  const snapshot = side === "YES" ? market.probability.yes : market.probability.no;
  const price = quote ?? snapshot;
  const shares = price > 0 ? amount / price : 0;
  const tooLow = balance != null && amount > balance;

  if (receipt) {
    return (
      <div style={{ display: "grid", gap: 14, paddingTop: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: pal.up }}>✓ {t.app.trade.placed}</div>
        <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.4, paddingInlineEnd: 36 }}>{title}</div>
        <div style={{ background: pal.card, borderRadius: 14, padding: 14, display: "grid", gap: 8, fontSize: 14 }}>
          <Row k={t.app.receipt.side} v={labelOf(side)} />
          <Row k={t.app.trade.cost} v={money(receipt.cost, fa)} />
          <Row k={t.app.trade.avgPrice} v={cents(receipt.avg, fa)} />
          <Row k={t.app.trade.shares} v={qty(receipt.shares, fa)} />
          <Row k={t.app.trade.payout} v={money(receipt.shares, fa)} strong color={pal.up} />
        </div>
        <button type="button" style={btn(pal, false)} onClick={() => onDrawer("positions")}>{t.app.trade.viewPositions}</button>
        <button type="button" style={btn(pal, true)} onClick={onClose}>{t.app.trade.done}</button>
      </div>
    );
  }

  async function place() {
    if (!market || market === "missing") return;
    setBusy(true);
    setError(null);
    try {
      const d = await authedPost<{ filledShares: number; costUsd: number; avgPrice: number }>("/webapp/v1/bet", {
        marketId: market.id,
        side,
        sizeUsdc: amount,
        quotedPrice: price,
      });
      setReceipt({ shares: d.filledShares, cost: d.costUsd, avg: d.avgPrice });
      track("trade_placed");
      void onPlaced();
    } catch (e) {
      const server = (e as ApiCallError & { serverMessage?: string })?.serverMessage;
      setError(e instanceof ApiCallError && e.kind === "unauthenticated" ? t.app.bet.sessionExpired : server ?? t.app.bet.failed);
    } finally {
      setBusy(false);
    }
  }

  const sideBtn = (s: TradeSide) => {
    const on = side === s;
    const col = s === "YES" ? pal.up : pal.down;
    const p = s === "YES" ? market.probability.yes : market.probability.no;
    return (
      <button
        type="button"
        onClick={() => setSide(s)}
        style={{ flex: 1, minWidth: 0, padding: "12px 8px", borderRadius: 12, cursor: "pointer", border: `1.5px solid ${on ? col : pal.line}`, background: on ? (s === "YES" ? pal.upBg : pal.downBg) : "transparent", color: pal.text, display: "grid", gap: 2, justifyItems: "center" }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: col, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{labelOf(s)}</span>
        <b style={{ fontSize: 20 }}>{cents(on && quote != null ? quote : p, fa)}</b>
      </button>
    );
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.4, paddingInlineEnd: 36 }}>{title}</div>
      <div style={{ display: "flex", gap: 8 }}>
        {sideBtn("YES")}
        {sideBtn("NO")}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
        {PRESETS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setAmount(v)}
            style={{ padding: "9px 2px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13.5, border: `1px solid ${v === amount ? pal.accent : pal.line}`, background: v === amount ? `${pal.accent}22` : "transparent", color: v === amount ? pal.accent : pal.text }}
          >
            {fa ? `${String(v).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d])}$` : `$${v}`}
          </button>
        ))}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, background: pal.card, borderRadius: 12, padding: "10px 12px", border: `1px solid ${pal.line}` }}>
        <span style={{ color: pal.mute, fontSize: 13 }}>{t.app.bet.customStakePlaceholder}</span>
        <input
          inputMode="decimal"
          aria-label={t.app.bet.customStakeLabel}
          value={String(amount)}
          onChange={(e) => {
            const v = Number(e.target.value.replace(/[^\d.]/g, ""));
            if (Number.isFinite(v)) setAmount(Math.min(10000, Math.max(0, v)));
          }}
          style={{ flex: 1, minWidth: 0, background: "transparent", border: 0, outline: 0, color: pal.text, fontSize: 16, fontWeight: 700, textAlign: "end", direction: "ltr" }}
        />
        <span style={{ color: pal.mute }}>$</span>
      </label>
      <div style={{ background: pal.card, borderRadius: 14, padding: 14, display: "grid", gap: 8, fontSize: 14 }}>
        <Row k={t.app.trade.livePrice} v={quote == null ? `${cents(snapshot, fa)} …` : cents(quote, fa)} />
        <Row k={t.app.trade.shares} v={qty(shares, fa)} />
        <Row k={t.app.trade.payout} v={money(shares, fa)} strong color={pal.up} />
        {shares > amount && <Row k={t.app.trade.profit} v={`+${money(shares - amount, fa)}`} color={pal.up} />}
        {balance != null && <Row k={t.app.trade.balance} v={money(balance, fa)} color={tooLow ? pal.down : undefined} />}
      </div>
      {tooLow ? (
        <>
          <p style={{ margin: 0, fontSize: 13, color: pal.down }}>{t.app.trade.tooLow}</p>
          <button type="button" style={btn(pal, true)} onClick={() => onDrawer("wallet")}>{t.app.trade.deposit}</button>
        </>
      ) : (
        <button type="button" disabled={busy || amount <= 0} onClick={place} style={btn(pal, true, busy || amount <= 0)}>
          {busy ? t.app.trade.placing : `${tf(t.app.trade.buy, { side: labelOf(side) })} · ${money(amount, fa)}`}
        </button>
      )}
      {error && <p style={{ margin: 0, fontSize: 13, color: pal.down }}>{error}</p>}
      <p style={{ margin: 0, fontSize: 11.5, color: pal.mute, textAlign: "center" }}>{t.app.trade.onPolymarket}</p>
    </div>
  );
}

function Row({ k, v, strong, color }: { k: string; v: string; strong?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ opacity: 0.7 }}>{k}</span>
      <span dir="auto" style={{ fontWeight: strong ? 800 : 600, color, unicodeBidi: "isolate" }}>{v}</span>
    </div>
  );
}

// ---------------------------------------------------------------- portfolio drawer

/**
 * Positions and Wallet (deposit, withdraw, activity, invite) on the page,
 * sliding in from the side — the same screens /app shows, so the two can
 * never disagree. Styled by the app's global CSS variables (--page, --ink…),
 * which every page carries.
 */
function Drawer({
  tab,
  setTab,
  balance,
  rtl,
  fa,
  onClose,
  onSignOut,
  onOpenMarket,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  balance: number | null;
  rtl: boolean;
  fa: boolean;
  onClose: () => void;
  onSignOut: () => void;
  onOpenMarket: (slug: string) => void;
}) {
  const { t } = useLocale();
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
  const tabBtn = (k: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(k)}
      style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: 0, cursor: "pointer", fontWeight: 700, fontSize: 14, background: tab === k ? "var(--ink)" : "transparent", color: tab === k ? "var(--on-ink)" : "var(--mute)" }}
    >
      {label}
    </button>
  );
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.45)" }}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t.app.trade.account}
        dir={rtl ? "rtl" : "ltr"}
        onClick={(e) => e.stopPropagation()}
        style={{ position: "absolute", top: 0, bottom: 0, [rtl ? "left" : "right"]: 0, width: "min(460px, 100vw)", background: "var(--page)", color: "var(--ink)", borderInlineStart: "1px solid var(--line)", display: "flex", flexDirection: "column", boxShadow: "0 0 60px rgba(0,0,0,.4)" }}
      >
        <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid var(--line)", display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "var(--mute)" }}>{t.app.trade.balance}</div>
              <div dir="auto" style={{ fontSize: 24, fontWeight: 800, unicodeBidi: "isolate" }}>{money(balance, fa)}</div>
            </div>
            <button type="button" onClick={onSignOut} style={{ border: 0, background: "transparent", color: "var(--mute)", fontSize: 13, cursor: "pointer" }}>
              {t.app.trade.signOut}
            </button>
            <button type="button" aria-label={t.app.trade.close} onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--line)", background: "transparent", color: "var(--mute)", cursor: "pointer" }}>
              ✕
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, background: "var(--card)", padding: 4, borderRadius: 12 }}>
            {tabBtn("positions", t.app.trade.positions)}
            {tabBtn("wallet", t.app.trade.wallet)}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {tab === "positions" ? <PositionsScreen onOpenMarket={onOpenMarket} /> : <WalletScreen />}
        </div>
      </aside>
    </div>
  );
}
