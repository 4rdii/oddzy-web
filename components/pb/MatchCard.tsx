import Link from "next/link";
import { Crest } from "@/components/pb/Crest";
import { fa, faVol } from "@/lib/pb";

export type MatchCardData = {
  href: string;
  home: string;
  away: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  /** Whole percents; draw null for a two-way contest. */
  h: number | null;
  d: number | null;
  a: number | null;
  time: string;
  meta?: string;
  vol?: number | null;
};

/**
 * One fixture as a card (PbMatchCard): both sides with their odds, the draw,
 * a three-segment odds bar with the favourite in gold, and volume.
 */
export function MatchCard({ m }: { m: MatchCardData }) {
  const vals = [m.h, m.d, m.a].filter((v): v is number => v !== null);
  const mx = vals.length ? Math.max(...vals) : -1;
  const c = (v: number | null) => (v !== null && v === mx ? "var(--gold)" : "var(--text2)");
  const seg = (v: number | null) => (v !== null && v === mx ? "var(--gold)" : "var(--line2)");
  const pct = (v: number | null) => (v === null ? "—" : `${fa(v)}٪`);
  const side = (name: string, logo: string | null | undefined, v: number | null) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 15, fontWeight: 600, lineHeight: 1.5, minWidth: 0 }}>
        <Crest name={name} src={logo} size={22} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      </span>
      <span style={{ fontSize: 16, fontWeight: 800, color: c(v) }}>{pct(v)}</span>
    </div>
  );
  return (
    <Link
      href={m.href}
      className="pb-card-link"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "14px 16px 13px",
        color: "var(--text)",
        height: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)" }}>
        <span
          style={{
            background: "var(--bg2)",
            border: "1px solid var(--line)",
            borderRadius: 7,
            padding: "2px 8px",
            color: "var(--text2)",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {m.time}
        </span>
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.meta ?? ""}</span>
        <span style={{ marginInlineStart: "auto", color: "var(--faint)" }}>←</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {side(m.home, m.homeLogo, m.h)}
        {side(m.away, m.awayLogo, m.a)}
      </div>
      <div style={{ display: "flex", gap: 3, height: 5, marginTop: "auto" }}>
        {[m.h, m.d, m.a].map((v, i) =>
          v === null ? null : <span key={i} style={{ flex: Math.max(v, 1), background: seg(v), borderRadius: 3 }} />,
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)" }}>
        <span>{m.d !== null && <>مساوی <b style={{ color: c(m.d), fontWeight: 700 }}>{pct(m.d)}</b></>}</span>
        <span>{faVol(m.vol)}</span>
      </div>
    </Link>
  );
}
