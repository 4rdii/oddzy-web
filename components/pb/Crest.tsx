"use client";

import Image from "next/image";
import { useState } from "react";
import { hueOf } from "@/lib/pb";

/**
 * Team or league logo, with a monogram fallback (PbCrest in the handoff).
 *
 * `src` is Polymarket's logo URL; next/image fetches it once server-side and
 * serves it from our own domain (see images.remotePatterns), so an Iranian
 * visitor never has to reach a foreign image host. No `src`, or a failed load,
 * falls back to the first letter on a colour hashed from the name.
 */
export function Crest({ name, src, size = 24 }: { name: string; src?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, flexShrink: 0 } as const;
  if (src && !failed) {
    return (
      <span style={{ ...box, display: "inline-flex", position: "relative" }}>
        <Image
          src={src}
          alt=""
          width={size}
          height={size}
          sizes={`${size}px`}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </span>
    );
  }
  const initial = name.replace(/^(باشگاه|فوتبال)\s*/g, "").trim().charAt(0);
  return (
    <span
      aria-hidden
      style={{
        ...box,
        borderRadius: "50%",
        background: `oklch(0.42 0.08 ${hueOf(name)})`,
        border: "1px solid var(--line2)",
        color: "#fff",
        fontWeight: 800,
        fontSize: Math.round(size * 0.42),
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {initial}
    </span>
  );
}
