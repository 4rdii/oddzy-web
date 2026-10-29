"use client";

import Link from "next/link";
import { useSyncExternalStore, type CSSProperties } from "react";
import { getMe, getServerMe, subscribeMe, tradeClick } from "@/lib/trade-bus";

/**
 * The header's Sign in / balance button. No auth SDK here: it reads the
 * store the trade runtime fills (lib/trade-bus) and, when the runtime is not
 * on this page, is just its /app link.
 */
export function AccountButton({ lang, label, className, style }: { lang: "en" | "fa"; label: string; className?: string; style?: CSSProperties }) {
  const me = useSyncExternalStore(subscribeMe, getMe, getServerMe);
  const fa = lang === "fa";
  const text =
    me.state === "in" && me.balance != null
      ? fa
        ? `${me.balance.toFixed(2).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]).replace(".", "٫")} دلار`
        : `$${me.balance.toFixed(2)}`
      : label;
  return (
    <Link
      prefetch={false}
      href="/app"
      className={className}
      style={style}
      onClick={(e) => tradeClick(e, { kind: me.state === "in" ? "account" : "signin" })}
    >
      {me.state === "in" && <span aria-hidden style={{ marginInlineEnd: 6 }}>●</span>}
      {text}
    </Link>
  );
}
