import Link from "next/link";
import type { LeagueHub, MarketEvent, SportHub } from "@/lib/api";
import type { Dict } from "@/lib/dict";
import { BRANDS, type Locale } from "@/lib/i18n";
import { localized, pct } from "@/lib/format";

/**
 * Sports hub pages — the indexed surface for sport (product rule 2026-09-24).
 *
 * A league hub outlives every fixture on it, so links and rankings it earns
 * accumulate instead of expiring with each match. Match pages stay live for
 * people (and redirects) but are noindex; the hub links to them.
 *
 * GEO: the page opens with plain, dated, quotable sentences ("Next up: X vs Y,
 * Thu 24 Sep. The market has it at …") and a short FAQ, because that is what
 * answer engines lift. Numbers are the market's, attributed as such.
 */

export type Side = { name: string; p: number | null };

/**
 * A fixture's headline odds in reading order: [home, draw, away] for football
 * (by position in the event title), [fighter A, fighter B] for a fight (one
 * market, YES = the first-named side).
 */
export function fixtureSides(lang: Locale, t: Dict, ev: MarketEvent): Side[] {
  const main = ev.main;
  const name = (label: string | null | undefined, labelFa: string | null | undefined) =>
    lang === "fa" ? labelFa ?? label ?? "" : label ?? "";
  const wins = main.filter((m) => m.kind === "moneyline");
  const draw = main.find((m) => m.kind === "draw");
  if (wins.length >= 2) {
    const title = ev.title.toLowerCase();
    const at = (l: string | null | undefined) => {
      const i = title.indexOf(String(l ?? "").toLowerCase());
      return i < 0 ? 1e9 : i;
    };
    const [a, b] = [...wins].sort((x, y) => at(x.label) - at(y.label));
    return [
      { name: name(a.label, a.label_fa), p: a.probability?.yes ?? null },
      ...(draw ? [{ name: t.match.draw, p: draw.probability?.yes ?? null }] : []),
      { name: name(b.label, b.label_fa), p: b.probability?.yes ?? null },
    ];
  }
  if (wins.length === 1 && / vs\.? /.test(String(wins[0].label ?? ""))) {
    const [a, b] = String(wins[0].label).split(/ vs\.? /, 2);
    const y = wins[0].probability?.yes ?? null;
    return [
      { name: a.trim(), p: y },
      { name: b.trim(), p: y === null ? null : 1 - y },
    ];
  }
  return [];
}

/** "Norway vs. Denmark" / «نروژ و دانمارک», from the translated side names when there are any. */
export function fixtureTitle(lang: Locale, t: Dict, ev: MarketEvent): string {
  if (lang !== "fa") return ev.title;
  const sides = fixtureSides(lang, t, ev).filter((s) => s.name !== t.match.draw);
  if (sides.length === 2 && ev.main.every((m) => m.kind !== "moneyline" || m.label_fa)) {
    return `${sides[0].name} و ${sides[1].name}`;
  }
  return (ev.title_fa ?? ev.title).replace(/\s+vs\.?\s+/g, " و ");
}

/** Played-out fixtures stay "active" until they settle; 3h past kick-off covers extra time. */
export function upcomingOnly(events: MarketEvent[]): MarketEvent[] {
  const cutoff = Date.now() - 3 * 3600_000;
  return events
    .filter((e) => e.kind === "match" && (!e.starts_at || new Date(e.starts_at).getTime() > cutoff))
    .sort((a, b) => String(a.starts_at ?? "").localeCompare(String(b.starts_at ?? "")));
}

const TZ = (lang: Locale) => (lang === "fa" ? "Asia/Tehran" : "UTC");

function dayLabel(iso: string, lang: Locale): string {
  return new Date(iso).toLocaleDateString(lang === "fa" ? "fa-IR-u-ca-gregory" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ(lang),
  });
}

function timeLabel(iso: string, lang: Locale): string {
  return new Date(iso).toLocaleTimeString(lang === "fa" ? "fa-IR" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ(lang),
  });
}

function shortDate(iso: string, lang: Locale): string {
  return new Date(iso).toLocaleDateString(lang === "fa" ? "fa-IR-u-ca-gregory" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: TZ(lang),
  });
}

const oddsText = (sides: Side[]) =>
  sides.filter((s) => s.p !== null).map((s) => `${s.name} ${pct(s.p as number)}%`).join(" · ");

/** "matches", or "fights" for combat sports. */
export function fixtureUnit(t: Dict, hub: LeagueHub): string {
  return t.hub.unit[hub.sport?.slug === "mma" ? "fights" : "matches"];
}

/** Fixtures that have not kicked off: what "next up" and "favourite" may cite. */
function notStarted(fixtures: MarketEvent[]): MarketEvent[] {
  const now = Date.now();
  return fixtures.filter((e) => !e.starts_at || new Date(e.starts_at).getTime() > now);
}

/** The quotable opening lines of a league hub, also reused for its meta description. */
export function leagueSummary(lang: Locale, t: Dict, hub: LeagueHub, fixtures: MarketEvent[]) {
  const league = localized(lang, hub.name, hub.name_fa);
  // An in-play or just-finished game (99% by now) is not "next up", and its
  // odds are not a forecast: cite only fixtures that have not started.
  const pending = notStarted(fixtures);
  const next = pending[0];
  const lines = [
    t.hub.leagueSummary
      .replace("{count}", String(fixtures.length))
      .replace("{league}", league)
      .replace("{unit}", fixtureUnit(t, hub)),
  ];
  if (next?.starts_at) {
    const sides = fixtureSides(lang, t, next);
    lines.push(
      t.hub.leagueNextSummary
        .replace("{match}", fixtureTitle(lang, t, next))
        .replace("{date}", shortDate(next.starts_at, lang))
        .replace("{odds}", oddsText(sides) || "—"),
    );
  }
  // The single biggest favourite across the list: a concrete, citable number.
  let best: { team: string; opp: string; p: number } | null = null;
  for (const ev of pending) {
    const sides = fixtureSides(lang, t, ev).filter((s) => s.name !== t.match.draw);
    if (sides.length !== 2) continue;
    for (const [i, s] of sides.entries()) {
      if (s.p !== null && (!best || s.p > best.p)) best = { team: s.name, opp: sides[1 - i].name, p: s.p };
    }
  }
  if (best && pending.length > 1) {
    lines.push(
      t.hub.leagueFavourite.replace("{team}", best.team).replace("{pct}", String(pct(best.p))).replace("{opp}", best.opp),
    );
  }
  return { league, lines, next };
}

function FixtureRow({ lang, t, ev }: { lang: Locale; t: Dict; ev: MarketEvent }) {
  const sides = fixtureSides(lang, t, ev);
  const lead = Math.max(...sides.map((s) => s.p ?? 0));
  return (
    <li>
      <Link
        href={`/match/${ev.id}`}
        className="flex flex-col gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--card)] p-4 text-[var(--ink)] sm:flex-row sm:items-center sm:gap-4"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] leading-snug font-semibold">{fixtureTitle(lang, t, ev)}</span>
          <span className="font-mono text-[11px] text-[var(--faint)]">
            {ev.starts_at ? timeLabel(ev.starts_at, lang) : "—"}
            {lang === "fa" ? " · تهران" : " UTC"} ·{" "}
            <span className="ltr-num">{t.hub.markets.replace("{count}", String(ev.market_count))}</span>
          </span>
        </span>
        {sides.length > 0 && (
          <span className="flex shrink-0 flex-wrap gap-1.5">
            {sides.map((s) => (
              <span
                key={s.name}
                className={`rounded-[9px] px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap ${
                  s.p !== null && s.p === lead ? "bg-[var(--uptint)] text-[var(--up)]" : "border border-[var(--line)] text-[var(--text2)]"
                }`}
              >
                {s.name} <span className="ltr-num font-mono">{s.p === null ? "—" : `${pct(s.p)}%`}</span>
              </span>
            ))}
          </span>
        )}
      </Link>
    </li>
  );
}

function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="font-mono text-[11px] tracking-[0.06em] text-[var(--mute)]">
      {items.map((it, i) => (
        <span key={`${it.name}-${i}`}>
          {i > 0 && " › "}
          {it.href ? <Link href={it.href}>{it.name}</Link> : it.name}
        </span>
      ))}
    </nav>
  );
}

export function LeagueHubView({
  lang,
  t,
  hub,
  fixtures,
  asOf,
}: {
  lang: Locale;
  t: Dict;
  hub: LeagueHub;
  fixtures: MarketEvent[];
  asOf: string | null;
}) {
  const brand = BRANDS[lang];
  const { league, lines } = leagueSummary(lang, t, hub, fixtures);
  const sport = hub.sport ? localized(lang, hub.sport.name, hub.sport.name_fa) : null;
  const faq = t.hub.faq.map((f) => ({ q: f.q.replace("{league}", league), a: f.a.replace("{league}", league) }));

  // Fixtures by day, in the reader's time zone (Tehran for PolyBaaz).
  const days = new Map<string, MarketEvent[]>();
  for (const ev of fixtures) {
    const key = ev.starts_at ? dayLabel(ev.starts_at, lang) : "—";
    if (!days.has(key)) days.set(key, []);
    days.get(key)!.push(ev);
  }

  const url = `${brand.siteUrl}/topic/${hub.slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t.hub.home, item: `${brand.siteUrl}/` },
        ...(hub.sport ? [{ "@type": "ListItem", position: 2, name: sport, item: `${brand.siteUrl}/topic/${hub.sport.slug}` }] : []),
        { "@type": "ListItem", position: hub.sport ? 3 : 2, name: league, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: t.hub.fixturesHeading,
      itemListElement: fixtures.slice(0, 50).map((ev, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "SportsEvent",
          name: fixtureTitle(lang, t, ev),
          ...(ev.starts_at ? { startDate: ev.starts_at } : {}),
          eventStatus: "https://schema.org/EventScheduled",
          ...(sport ? { sport } : {}),
          url: `${brand.siteUrl}/match/${ev.id}`,
        },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <article className="mx-auto max-w-3xl px-5 pt-10 pb-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs
        items={[
          { name: t.hub.home, href: "/" },
          ...(hub.sport && sport ? [{ name: sport, href: `/topic/${hub.sport.slug}` }] : []),
          { name: league },
        ]}
      />
      <h1 className="mt-3 text-[clamp(26px,4.5vw,38px)] leading-[1.15] font-bold tracking-[-0.03em]">
        {t.hub.leagueH1.replace("{league}", league)}
      </h1>
      <div className="mt-4 flex max-w-2xl flex-col gap-2 text-[15px] leading-relaxed text-[var(--text2)]">
        {lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
      {asOf && (
        <p className="mt-3 font-mono text-[11px] text-[var(--faint)]">
          <span className="ltr-num">{t.hub.updated.replace("{date}", new Date(asOf).toISOString().slice(0, 16).replace("T", " "))}</span>
        </p>
      )}

      <section className="mt-9">
        <h2 className="text-[17px] font-bold tracking-[-0.01em]">
          {hub.sport?.slug === "mma" ? t.hub.fixturesHeadingFights : t.hub.fixturesHeading}
        </h2>
        <div className="mt-4 flex flex-col gap-6">
          {[...days.entries()].map(([day, evs]) => (
            <div key={day}>
              <h3 className="font-mono text-[11px] tracking-[0.06em] text-[var(--faint)]">{day}</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {evs.map((ev) => (
                  <FixtureRow key={ev.id} lang={lang} t={t} ev={ev} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[17px] font-bold tracking-[-0.01em]">{t.hub.faqHeading}</h2>
        <dl className="mt-4 flex flex-col gap-4">
          {faq.map((f) => (
            <div key={f.q} className="rounded-xl border border-[var(--line)] p-4">
              <dt className="text-[15px] font-semibold">{f.q}</dt>
              <dd className="mt-1.5 text-[14px] leading-relaxed text-[var(--text2)]">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
}

export function SportHubView({
  lang,
  t,
  sport,
  leagues,
}: {
  lang: Locale;
  t: Dict;
  sport: SportHub;
  leagues: { hub: LeagueHub; next: MarketEvent[] }[];
}) {
  const brand = BRANDS[lang];
  const name = localized(lang, sport.name, sport.name_fa);
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t.hub.home, item: `${brand.siteUrl}/` },
        { "@type": "ListItem", position: 2, name, item: `${brand.siteUrl}/topic/${sport.slug}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: t.hub.leaguesHeading,
      itemListElement: leagues.map((l, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: localized(lang, l.hub.name, l.hub.name_fa),
        url: `${brand.siteUrl}/topic/${l.hub.slug}`,
      })),
    },
  ];
  return (
    <article className="mx-auto max-w-3xl px-5 pt-10 pb-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs items={[{ name: t.hub.home, href: "/" }, { name }]} />
      <h1 className="mt-3 text-[clamp(26px,4.5vw,38px)] leading-[1.15] font-bold tracking-[-0.03em]">
        {t.hub.sportH1.replace("{sport}", name)}
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--text2)]">
        {t.hub.sportSummary.replace("{count}", String(sport.upcoming)).replace("{leagues}", String(leagues.length))}
      </p>

      <section className="mt-9 flex flex-col gap-8">
        <h2 className="sr-only">{t.hub.leaguesHeading}</h2>
        {leagues.map(({ hub, next }) => (
          <div key={hub.slug}>
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-[17px] font-bold tracking-[-0.01em]">
                <Link href={`/topic/${hub.slug}`}>{localized(lang, hub.name, hub.name_fa)}</Link>
              </h3>
              <span className="font-mono text-[11px] text-[var(--faint)]">
                <span className="ltr-num">{t.hub.upcomingCount.replace("{count}", String(hub.upcoming))}</span>
              </span>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {next.map((ev) => (
                <FixtureRow key={ev.id} lang={lang} t={t} ev={ev} />
              ))}
            </ul>
            <Link href={`/topic/${hub.slug}`} className="mt-2 inline-block text-[13px] font-semibold text-[var(--accent)]">
              {t.hub.seeAll.replace("{count}", String(hub.upcoming))}
            </Link>
          </div>
        ))}
      </section>
    </article>
  );
}
