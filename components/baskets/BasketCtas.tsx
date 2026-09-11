"use client";

import { useEffect, useRef } from "react";
import { captureSource, track } from "@/lib/track";

/**
 * The two buy buttons on a basket page, with attribution.
 *
 * Server-rendered with plain hrefs (the page is static and crawlable, and the
 * links must work with JS off). After mount this reads `?src=` from the URL —
 * a server-side searchParam read would make the ISR route dynamic for every
 * visitor to serve the few who arrive via a shared link — and carries the
 * source into both destinations:
 *
 *  - Telegram: `start=bsk_<slug>_<src>`; the bot strips the suffix and audits
 *    a `basket_open` with it (apps/bot/src/commands/start.ts).
 *  - Web app: `/app?basket=<slug>&src=<src>`; MiniApp remembers it for the
 *    register and buy calls.
 *
 * The view is recorded once per mount and the tap on either button just
 * before it navigates. Both are best-effort and never block the click.
 */
export function BasketCtas({
  slug,
  tgBot,
  webLabel,
  tgLabel,
}: {
  slug: string;
  tgBot: string;
  webLabel: string;
  tgLabel: string;
}) {
  // The source is written straight onto the anchors rather than held in
  // state: the server-rendered hrefs are already correct without it, and a
  // DOM update from an effect is the sanctioned shape for enhancing them.
  const webHref = `/app?basket=${encodeURIComponent(slug)}`;
  const tgHref = `https://t.me/${tgBot}?start=bsk_${slug}`;
  const webRef = useRef<HTMLAnchorElement>(null);
  const tgRef = useRef<HTMLAnchorElement>(null);
  const srcRef = useRef<string | null>(null);

  useEffect(() => {
    const src = captureSource();
    srcRef.current = src;
    if (src) {
      if (webRef.current) webRef.current.href = `${webHref}&src=${encodeURIComponent(src)}`;
      if (tgRef.current) tgRef.current.href = `${tgHref}_${src}`;
    }
    track("basket_view", { basket: slug, src });
  }, [slug, webHref, tgHref]);

  return (
    <div className="mt-4">
      <a
        ref={webRef}
        href={webHref}
        onClick={() => track("basket_cta", { basket: slug, target: "web", src: srcRef.current })}
        className="block w-full rounded-xl px-5 py-3.5 text-center text-[15px] font-bold"
        style={{
          background: "var(--bk-cta)",
          color: "var(--bk-cta-ink)",
          boxShadow: "var(--bk-cta-shadow)",
        }}
      >
        {webLabel}
      </a>
      <a
        ref={tgRef}
        href={tgHref}
        onClick={() => track("basket_cta", { basket: slug, target: "tg", src: srcRef.current })}
        className="mt-3 block text-center text-[14px] font-medium text-[var(--mute)] underline underline-offset-4"
      >
        {tgLabel}
      </a>
    </div>
  );
}
