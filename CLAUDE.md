# CLAUDE.md — kari.front

The web app for Kari, the door system for a Tbilisi bar. Next.js 16 (App Router), TypeScript,
Tailwind v4. It renders; the API (`kari.back`) owns all data and every rule.

`AGENTS.md` in this folder is written by `next dev`. Heed it: **this Next.js has breaking
changes. Read the guide in `node_modules/next/dist/docs/` before using an API you have not
used in this version.**

## Commands

```bash
pnpm dev            # http://localhost:3000 — needs the API on :5080
pnpm typecheck
pnpm lint
pnpm test           # vitest: src/**/*.test.ts
pnpm e2e            # playwright: real browser, real API, the throwaway database
pnpm build
vercel --prod       # deploy
```

**Do not run `pnpm build` while `pnpm dev` is running here.** They share `.next`; every open
tab reloads in a loop until the build ends.

## Where things are

```
src/
  venue.ts               the bar's name and details — rename the venue here, nowhere else
  app/
    (ka)/                Georgian public pages: /, /privacy        — static
    (en)/en/             English public pages:  /en, /en/privacy   — static
    (app)/               everything behind sign-in                 — rendered per request
      join/ login/
      (member)/pass/ invites/ profile/
      i/[code]/          an invite link — works with no account
      t/[token]/         a ticket issued at the door — works with no account
      door/              the scanner (staff, admin)
      admin/             the back office (admin)
    api/[...path]/       passes every /api/* call on to the .NET API
    sitemap.ts robots.ts manifest.ts icon.svg
  components/            ticket, live-ticket, stamp, qr, night-picker, app-chrome (dock), brand, icons
  i18n/                  en.ts, ka.ts, formatters, provider
  lib/                   api (browser), server-api (server), pass-code, types, photo
e2e/                     playwright flows
```

**Before working on an area, read its page under [`docs/domains/`](docs/domains/README.md).**

## Rules

- **Never compute "tonight".** A bar night crosses midnight and only the API knows which night
  it is. Print the dates the API sends. `formatNight` formats a date string; it does not decide one.
- **`lib/pass-code.ts` has a twin** in `kari.back/…/Domain/PassCode.cs`. `pass-code.test.ts`
  pins the shared vector. Change both sides and both tests together.
- **Browser code calls `/api/*` on this site only** — through `lib/api.ts`. Never the API's own
  address. Server components use `lib/server-api.ts`, which forwards the visitor's cookies.
- **Every string comes from `i18n/en.ts` and `i18n/ka.ts`.** Same keys, same placeholders; a
  test fails otherwise. Errors arrive from the API as codes and are worded in `errors`.
- **Never ask `Intl` for Georgian.** Chrome has no Georgian date data and answers in English.
  Use `formatNight`, `formatTime`, `formatDateTime`, `formatDate` from `i18n/index.ts`.
- **Never attach a case ending to a name in Georgian.** Names may be Latin. Write
  "მომწვევი: {name}", not "{name}-ის სტუმარი".
- **Public pages must stay static.** `(ka)` and `(en)` must not read cookies or headers. Their
  language is in the URL.
- **`cacheComponents` is off on purpose** (`next.config.ts`). Signed-in pages read the session
  on every request; a stale pass at the door is worse than a slower page.
- **Do not call `setState` synchronously in an effect.** The lint rule forbids it. Derive the
  value, or set it from a promise or an event. See `scanner.tsx` and `live-ticket.tsx`.
- **No stamp, badge or overlay on a QR code.** It breaks the scan.

## Design in one paragraph

Two materials: stamp ink and cloakroom-ticket paper. The ground is ink (`--color-ink`). Anything
a guest holds — a pass, an invite, a form — is paper laid on it. Every status is a round door
stamp. One type family (Noto Sans Georgian) in two widths: condensed for headlines, regular for
text. The back office alone is a light "desk". Full rules: `docs/domains/design.md`.

"Powered by wox.ge" appears on the landing header, the hero, the foot of the landing page, the
stub of every pass, and under the sign-in forms. Keep it small; the bar's name is the loud one.

## Environment

| Variable | What |
|---|---|
| `API_URL` | Where the .NET API is. Server-side only. Read at request time. |
| `NEXT_PUBLIC_SITE_URL` | This site's public address, for canonical links and the sitemap. On Vercel it falls back to the project's production URL. |

## Deploy

Vercel project `kari` (team `lgedenidzes-projects`), linked from this folder. `API_URL` is set
in the project's production environment. `vercel --prod` deploys. Live at
https://kari-kappa.vercel.app.
