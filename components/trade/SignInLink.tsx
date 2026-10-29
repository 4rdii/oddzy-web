"use client";

import Link from "next/link";
import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { getMe, getServerMe, subscribeMe, tradeClick } from "@/lib/trade-bus";

/** A "start trading" link: sign-in on the page (or the portfolio when signed in); /app as the fallback. */
export function SignInLink({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  const me = useSyncExternalStore(subscribeMe, getMe, getServerMe);
  return (
    <Link prefetch={false} href="/app" className={className} style={style} onClick={(e) => tradeClick(e, { kind: me.state === "in" ? "account" : "signin" })}>
      {children}
    </Link>
  );
}
