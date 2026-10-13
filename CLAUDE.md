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

node e2e/phone-audit.mjs 360     # photographs every screen at phone size
node e2e/warm-tabs.mjs           # what a tap on the dock costs — production builds only
```

**Do not run `pnpm build` while `pnpm dev` is running here.** They share `.next`; every open
tab reloads in a loop until the build ends.

**If every page reloads in a loop with only `pnpm dev` running,** its cache is broken — a dev
server that was killed, not stopped, leaves it so. The browser console repeats
"[Fast Refresh] rebuilding". Stop `pnpm dev`, delete `.next/dev`, start it again.

## Where things are

```
src/
  venue.ts               the bar's name and details — rename the venue here, nowhere else
  app/
    (ka)/                Georgian public pages: /, /privacy        — static
    (en)/en/             English public pages:  /en, /en/privacy   — static
    (app)/               everything behind sign-in                 — rendered per request
      join/ login/
      i/[code]/          an invite link — works with no account
      t/[token]/         a ticket issued at the door — works with no account
      (signed)/          one layout for every signed-in screen: the account and the dock
        (member)/pass/ invites/ profile/
        door/            the scanner (staff, admin)
        admin/           the back office (admin)
    api/[...path]/       passes every /api/* call on to the .NET API
    manifest.webmanifest/  the home-screen manifest; invite and ticket pages serve their own
    …/ticket.png/        the ticket as a picture, for the download button (pass, invite, door ticket)
    …/wallet.pkpass/     the ticket for an iPhone's Wallet, beside each picture
    …/google-wallet/     the same for an Android phone: a redirect to Google with a signed link
    sitemap.ts robots.ts icon.svg apple-icon.png
  components/            ticket, live-ticket, stamp, qr, night-picker, app-chrome (dock), brand, icons, face,
                         decision-chip (what the door wrote down, in every list of its records),
                         return-action (the landing page's action for someone who comes back),
                         loading (skeletons), use-live (a screen's data), save-to-phone
  i18n/                  en.ts, ka.ts, formatters, provider
  lib/                   api (browser), server-api (server), live-store (what each screen last heard),
                         known-here (what this phone remembers, for the public pages),
                         profile-link (the name of the network a guest's profile is on),
                         pass-code, scan-presence, web-manifest, types, photo,
                         pkpass (builds and signs a Wallet pass file), wallet-ticket (what a ticket
                         says in Wallet), wallet-strip (the paper ticket across the pass, drawn for
                         each one), wallet-pass (the certificate, and the answer to the phone),
                         ticket-fonts (the typeface of every picture the server draws),
                         google-pass (what a pass says in Google Wallet, and the signed link),
                         google-api (stores a pass at Google), google-wallet (the key, and
                         the answer to the phone)
assets/fonts/            static fonts for the ticket picture (the app itself uses next/font)
assets/wallet/           a Wallet pass's icon, logo and stamp (e2e/wallet-art.mjs draws them), and
                         Apple's public intermediate certificate
public/wallet/           what Google Wallet fetches from the site: the logo; and Google's own
                         "Add to Google Wallet" button, in Georgian and English — never redraw it
e2e/                     flow.spec.ts (the journeys), loading.spec.ts (how a screen arrives, on a slowed
                         server), ticket-image.spec.ts; phone-audit.mjs, warm-tabs.mjs, ticket-image.mjs
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
- **A screen arrives in one step.** Its page fetches the first answer on the server
  (`firstAnswer`), the screen reads it with `useLive`, and it has exactly one placeholder,
  shared with its `loading.tsx`. No spinner, no visible "loading", no second placeholder.
  `docs/domains/structure.md` → "Arriving on a screen". `e2e/loading.spec.ts` enforces it.
- **One failed refresh is not an error.** `useLive` retries, and stays quiet while the screen
  has its content. Do not show a poll's failure yourself.
- **Never write to `lib/live-store.ts` while rendering.** On the server that module is shared
  by every visitor.
- **Nothing that wraps a screen may keep a transform** — it traps every full-screen sheet
  inside the screen (BUG-0003).
- **No stamp, badge or overlay on a QR code.** It breaks the scan.
- **The pass key and the live code never leave the live ticket.** The downloadable picture
  and the Wallet pass carry the ticket's address and short code — a member's card in Wallet,
  the member's own code — and nothing that admits by itself.
- **The door's screen claims only what it can show.** "Live code" only for a code read live;
  "already in" with who let them in; no "first time here" for someone nobody counts. And
  whatever one tap does at the door, one tap takes back (BUG-0008).
- **Check every screen at phone size before calling UI work done:** `node e2e/phone-audit.mjs 360`
  photographs all of them into `test-results/phone/` and reports any that scroll sideways.
  `node e2e/find-overflow.mjs <path>` names the element at fault.
- **Georgian needs room.** Words are long ("კონფიდენციალურობა") and letters hang low (ვ, ფ, პ).
  Titles use the fluid `.title` size; never clip a line of Georgian with a tight `leading-none`.
- **iOS date and time inputs ignore `width: 100%`** unless their native appearance is removed.
  `.input` handles it; use `.input` on every field.

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
| `GOOGLE_WALLET_KEY`, `GOOGLE_WALLET_ISSUER_ID` | The key file of the Google service account the bar's Google Wallet issuer account has let in (JSON, base64), and that issuer's number, for "Add to Google Wallet". **Secrets — never committed.** Without them the feature is simply absent. `scripts/google-wallet.sh` checks and installs them. |
| `APPLE_PASS_P12`, `APPLE_PASS_P12_PASSWORD` | The bar's Pass Type ID certificate from Apple (a .p12, base64) and its password, for "Add to Apple Wallet". **Secrets — never committed.** Without them the feature is simply absent. `scripts/wallet-certificate.sh` installs them. |

## Deploy

Vercel project `kari` (team `lgedenidzes-projects`), linked from this folder. `API_URL` is set
in the project's production environment. `vercel --prod` deploys. Live at
https://kari-kappa.vercel.app.
