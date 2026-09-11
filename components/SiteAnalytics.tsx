"use client";

import { Analytics } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics, filtered to the funnel pages.
 *
 * The Hobby plan allows 2,500 events a month, so only the pages a shared link
 * can land on are counted — blog and market pages would burn the quota on
 * crawler-adjacent traffic and tell us nothing about the funnel. Per-visitor
 * journeys live in audit_log via lib/track.ts; this is referrer / country /
 * device in aggregate.
 *
 * A client component because `beforeSend` is a function, and a server layout
 * cannot hand a function to a client component.
 */
export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        const path = new URL(event.url).pathname;
        return /^(?:\/(?:en|fa))?\/(?:baskets\/|app(?:\/|$))/.test(path) ? event : null;
      }}
    />
  );
}
