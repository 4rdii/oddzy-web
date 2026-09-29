import type { MarketEvent, Team } from "@/lib/api";
import type { MatchCardData } from "@/components/pb/MatchCard";
import { faTime, pc } from "@/lib/pb";

/**
 * A fixture from /events as a PbMatchCard, in the handoff's reading order:
 * home (first-named side), draw, away.
 *
 * Logos come from the event's `teams` block, matched to each side by name so a
 * fixture whose title order disagrees with Polymarket's home/away still gets
 * the right crest on the right row.
 */
export function fixtureCard(ev: MarketEvent, meta: string): MatchCardData | null {
  const wins = ev.main.filter((m) => m.kind === "moneyline");
  const draw = ev.main.find((m) => m.kind === "draw") ?? null;
  const title = ev.title.toLowerCase();
  const at = (l: string | null | undefined) => {
    const i = title.indexOf(String(l ?? "").toLowerCase());
    return i < 0 ? 1e9 : i;
  };
  const teams = [ev.teams?.home, ev.teams?.away].filter((t): t is Team => !!t);
  const logo = (label: string | null | undefined, i: number) =>
    teams.find((t) => t.name.toLowerCase() === String(label ?? "").toLowerCase())?.logo ?? teams[i]?.logo ?? null;
  const time = ev.starts_at ? faTime(ev.starts_at) : "—";

  if (wins.length >= 2) {
    const [a, b] = [...wins].sort((x, y) => at(x.label) - at(y.label));
    return {
      href: `/match/${ev.id}`,
      home: a.label_fa ?? a.label ?? "",
      away: b.label_fa ?? b.label ?? "",
      homeLogo: logo(a.label, 0),
      awayLogo: logo(b.label, 1),
      h: pc(a.probability?.yes ?? null),
      d: draw ? pc(draw.probability?.yes ?? null) : null,
      a: pc(b.probability?.yes ?? null),
      time,
      meta,
      vol: ev.volume_24h,
    };
  }
  // A fight: one market, YES = the first-named side.
  if (wins.length === 1 && / vs\.? /.test(String(wins[0].label ?? ""))) {
    const [x, y] = String(wins[0].label).split(/ vs\.? /, 2).map((s) => s.trim());
    const yes = wins[0].probability?.yes ?? null;
    return {
      href: `/match/${ev.id}`,
      home: x,
      away: y,
      homeLogo: logo(x, 0),
      awayLogo: logo(y, 1),
      h: pc(yes),
      d: null,
      a: yes === null ? null : pc(1 - yes),
      time,
      meta,
      vol: ev.volume_24h,
    };
  }
  return null;
}
