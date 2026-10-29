"use client";

import { usePathname } from "next/navigation";
import { Component, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { hasSessionHint, onTradeMsg, type TradeMsg } from "@/lib/trade-bus";
import type { Locale } from "@/lib/i18n";

type RuntimeProps = { lang: Locale; pending: TradeMsg | null; clear: () => void };

/**
 * Pages that mount their own Privy provider. A second provider on the same
 * page would fight it, so the host stays off there and entry points fall back
 * to their /app links (see lib/trade-bus).
 */
// The basket index and builder have their own provider; a basket detail page does not.
const OWN_PROVIDER = /^\/(app|creator)(\/|$)|^\/baskets(\/new)?\/?$/;

/**
 * Mounted once in the layout. Costs nothing until used: the runtime (Privy +
 * trade modal, a few hundred KB) is imported on the first trade / sign-in
 * message, or in the background when this browser already has a session.
 */
export function TradeHost({ lang }: { lang: Locale }) {
  const path = usePathname() ?? "/";
  const off = OWN_PROVIDER.test(path);
  const [Runtime, setRuntime] = useState<ComponentType<RuntimeProps> | null>(null);
  const [pending, setPending] = useState<TradeMsg | null>(null);

  useEffect(() => {
    if (off) return;
    const w = window as unknown as { __ozTradeHost?: boolean };
    w.__ozTradeHost = true;
    let loading = false;
    const load = () => {
      if (loading) return;
      loading = true;
      import("./TradeRuntime")
        .then((m) => setRuntime(() => m.TradeRuntime))
        .catch(() => {
          // Chunk failed (offline, deploy mid-session): let links navigate again.
          w.__ozTradeHost = false;
        });
    };
    const unsub = onTradeMsg((m) => {
      setPending(m);
      load();
    });
    let idle = 0;
    if (hasSessionHint()) {
      const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      idle = ric ? ric(load, { timeout: 4000 }) : window.setTimeout(load, 2500);
    }
    return () => {
      unsub();
      w.__ozTradeHost = false;
      if (idle) clearTimeout(idle);
    };
  }, [off]);

  if (off || !Runtime) return null;
  return (
    <Contain>
      <Runtime lang={lang} pending={pending} clear={() => setPending(null)} />
    </Contain>
  );
}

/**
 * A runtime failure (Privy refusing the environment, a chunk error) must never
 * take the page down with it: render nothing, and let every trade button fall
 * back to its /app link.
 */
class Contain extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    (window as unknown as { __ozTradeHost?: boolean }).__ozTradeHost = false;
    console.error("[trade] runtime failed; links fall back to /app:", e);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
