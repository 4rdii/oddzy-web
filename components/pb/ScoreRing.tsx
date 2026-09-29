import { fa } from "@/lib/pb";
import { ringDash } from "@/components/pb/whale";

/** The whale score as a ring (44px in rows, 68px in the profile sheet). */
export function ScoreRing({ score, color, size = 44, stroke = 3.5 }: { score: number | null; color: string; size?: number; stroke?: number }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 44 44" style={{ transform: "rotate(-90deg)", display: "block" }} aria-hidden>
        <circle cx="22" cy="22" r="18" fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle cx="22" cy="22" r="18" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={ringDash(score)} />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size > 50 ? 21 : 14,
          fontWeight: size > 50 ? 900 : 800,
          color,
        }}
      >
        {score === null ? "—" : fa(score)}
      </div>
    </div>
  );
}

const PROXIED = /^https:\/\/polymarket-upload\.s3\.us-east-2\.amazonaws\.com\//;

/**
 * A whale's avatar: their Polymarket image when they have one, else a gradient
 * seeded by name (the handoff used a third-party avatar service; generating it
 * here keeps every byte on our own domain).
 */
export function Avatar({ name, src: raw, size = 22 }: { name: string; src: string | null; size?: number }) {
  // Only hosts next.config allows can go through the optimizer; anything else
  // gets the generated avatar rather than a hotlink.
  const src = raw && PROXIED.test(raw) ? `/_next/image?url=${encodeURIComponent(raw)}&w=64&q=75` : null;
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        backgroundColor: "var(--bg2)",
        backgroundImage: src
          ? `url(${JSON.stringify(src)})`
          : `conic-gradient(from ${h}deg, oklch(0.62 0.13 ${h}), oklch(0.5 0.12 ${(h + 90) % 360}), oklch(0.66 0.1 ${(h + 200) % 360}), oklch(0.62 0.13 ${h}))`,
        backgroundSize: "cover",
        boxShadow: "0 0 0 1px var(--line2)",
        display: "inline-block",
      }}
    />
  );
}
