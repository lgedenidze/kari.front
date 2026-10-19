# kari.front

The web app for Kari, the door and guest-list system for a Tbilisi bar. Guests request access,
hold a QR pass for the night and invite named guests; door staff scan and decide; the bar runs
it from a back office. Georgian and English.

Next.js 16 · TypeScript · Tailwind v4. The API lives in `kari.back`.

Live: https://kari.wox.ge

## Run

```bash
pnpm install
cp .env.example .env.local     # API_URL points at the API; the default is http://localhost:5080
pnpm dev                       # http://localhost:3000
```

The browser only ever talks to this site. Every `/api/*` request is passed on to the API by
`src/app/api/[...path]/route.ts`, which keeps the session cookie same-origin.

## Check

```bash
pnpm typecheck
pnpm lint
pnpm test        # unit tests
pnpm e2e         # real browser against the real API — see playwright.config.ts for the database it needs
pnpm build
```

## Deploy

```bash
vercel --prod
```

The Vercel project needs one variable, `API_URL`: the address of the API.

## Rename the venue

The app carries the name **KARI** (კარი). Change it in
`src/venue.ts` — the wordmark, the stamps, the metadata and the app manifest all read from there.

## Find your way

- `CLAUDE.md` — the rules that keep this app correct.
- `docs/domains/` — one page per area: structure, design, tickets, door and back office.
- `docs/bugs/` — defects worth remembering.
