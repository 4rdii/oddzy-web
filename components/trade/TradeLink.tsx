"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { tradeClick, type TradeRequest } from "@/lib/trade-bus";

/**
 * A "trade this market" link that opens the website's trade modal, keeping
 * `href` (into /app) as the fallback for no-JS, modified clicks and pages
 * without the trade host.
 */
export function TradeLink({ href, req, className, style, children }: { href: string; req: TradeRequest; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <Link prefetch={false} href={href} className={className} style={style} onClick={(e) => tradeClick(e, { kind: "trade", req })}>
      {children}
    </Link>
  );
}
