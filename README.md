# oddzy-web

The Oddzy web surface: **one codebase, two modes**.

- Opened in a normal browser → a crawlable marketing site + blog (the SEO surface).
- Opened inside Telegram → the Mini App trading UI.

Detection is `window.Telegram.WebApp` with non-empty `initData`, checked **client-side only**.
Server-rendered HTML is always the marketing variant, so Googlebot — which has no Telegram
object — always gets marketing mode. There is no separate rendering path for bots.

## Routes

| Route | Mode | Rendering |
|---|---|---|
| `/` | site | ISR 5m — hero + live market ticker |
| `/how-it-works`, `/faq` | site | static (`FAQPage` JSON-LD on `/faq`) |
| `/learn`, `/learn/[slug]` | site | SSG from `content/posts/*.mdx` (`Article` JSON-LD) |
| `/app` | app | ISR 5m, `noindex` — the trading surface |

The blog is deliberately a **web-only** surface: the app shell never links to it, and `/app`
is excluded from `robots.txt` and the sitemap. It exists to rank, not to be browsed in a
webview.

## Data

Two different paths, for two different reasons:

- **Market data** → `lib/api.ts` (server-only) calls the Oddzy content API with a bearer
  token, exposed to the browser through `/api/markets` and `/api/categories`. The token must
  never reach the client, which is why this one proxies.
- **User data** (balance, positions) → `lib/client-api.ts` calls the bot server at
  `app.oddzy.xyz/api/v1/*` **directly** from the browser, authenticated with the Telegram
  `initData` the client already holds. No proxy hop; the bot allow-lists our origins.

Category chips are two-level, driven by the live taxonomy (`Group › Sub`). See
`lib/taxonomy.ts` — sections are curated, leaves come from the API, and an unmapped group
becomes its own section so new categories appear without a deploy here.

## Environment

| Var | Purpose |
|---|---|
| `ODDZY_API_TOKEN` | Bearer for the content API. **Server-only.** |
| `ODDZY_API_BASE` | Default `https://app.oddzy.xyz/api` |
| `NEXT_PUBLIC_API_BASE` | Bot server origin, default `https://app.oddzy.xyz` |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin, drives sitemap + canonicals |
| `NEXT_PUBLIC_TG_BOT` | Bot username for deep links |

## Local development

```bash
npm install
npm run dev
```

`.env.local` is gitignored and holds the API token.

## Status

`POST /api/bet` is a deliberate **501 stub**. Bet placement must go through the bot's
order-signing path (bet lock → CLOB creds → executor → picks row → rev-share accrual), and
that shared core hasn't been extracted yet. The UI surfaces "not wired up" rather than
fabricating a receipt — do not "fix" it by mocking a response.

## Design

Ported from the Claude Design prototype (`Oddzy.dc.html`). Tokens in `app/globals.css` are
verbatim from it — Space Grotesk + IBM Plex Mono, paper/ink day theme and a night theme.

Base CSS **must** stay inside `@layer base`: Tailwind v4 puts utilities in a cascade layer,
and unlayered CSS beats layered CSS regardless of specificity, so a bare `a { color }` would
override every `text-*` utility on a link.
