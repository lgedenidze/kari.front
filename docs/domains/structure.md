# Structure

How a request finds its page, how the page knows who is asking, and how it reaches the API.

## Three root layouts

There is no `app/layout.tsx`. Each route group has its own root layout, all built on
`components/shell.tsx`:

| Group | Routes | Language | Rendering |
|---|---|---|---|
| `(ka)` | `/`, `/privacy` | Georgian, fixed | static, revalidated every minute |
| `(en)` | `/en`, `/en/privacy` | English, fixed | static, revalidated every minute |
| `(app)` | everything else | the visitor's saved choice | per request |

Why: the public pages must be static and each must declare its own `<html lang>`. A single root
layout that read the language cookie would make them dynamic and give `/en` the wrong `lang`.

Moving between groups is a full page load. That is fine: it only happens between the landing
page and the app.

## Language

- **Public pages:** the URL decides. `/` is Georgian, `/en` is English. Each links to the other
  with `hreflang`. Visiting one saves its language in the `kari_lang` cookie (`RememberLang`),
  so the app opens in the same language.
- **App pages:** `i18n/server.ts#getLang` — the cookie, else the browser's `Accept-Language`,
  else Georgian. The toggle (`LangToggle`) sets the cookie and refreshes. In a top bar it is
  a two-letter code, as on the landing page; in the profile it is spelled out.
- Strings: `i18n/en.ts` and `i18n/ka.ts`, typed so they must have the same shape.
  `format.test.ts` also checks placeholders match.
- Client components read strings with `useI18n()`; server components with `getDict(lang)`.

## Signing in and guards

The session is an httpOnly cookie set by the API. This app never sees a token.

- Server components ask `lib/server-api.ts`:
  - `getMe()` — the visitor or null. Cached for the request.
  - `requireMe(returnTo, roles?)` — redirects to `/login?next=…` when signed out, and to `/pass`
    when the role is not allowed.
- `/door` requires `staff` or `admin`. `/admin` requires `admin`.
- `(signed)/layout.tsx` wraps every signed-in screen — pass, invites, profile, door, admin — in
  the account provider and the dock. It is the reason the dock never unmounts, and so can slide
  its marker between any two places. It does not redirect; each page calls `requireMe` with its
  own path and roles, so the visitor returns to exactly that page.
- `(signed)/(member)/layout.tsx` adds the top bar and the phone-width column for the pass,
  invites and profile.
- `/login` only ever redirects to a path on this site (`safeNext`).
- Client components get the account from `useMe()` (`components/me.tsx`).
- **Signing in is a full page load** (`lib/fresh-page.ts`), not a move inside the app. The app
  holds things for whoever is signed in — screens fetched ahead, each screen's last answer —
  and a full load throws them away before the next account sees anything. Signing out leaves
  for the landing page, which is a full load by itself, and also empties the store. A session
  that ends while the app is open sends the visitor to `/login` the same way.

These guards are for a good experience. **The API enforces access.** A hidden button protects
nothing.

## The API proxy

`app/api/[...path]/route.ts` passes every `/api/*` request to the .NET API.

- It keeps the cookie same-origin, so there is no CORS and no token in the browser.
- It forwards: `cookie`, `content-type`, `accept`, `accept-language`, `user-agent`, `origin`,
  `sec-fetch-site`.
- It adds `x-forwarded-for` (the guest's address, for the API's rate limiter) and
  `x-forwarded-host` (the host the browser asked for). The API compares `x-forwarded-host` with
  `Origin` to tell this site's own pages from a foreign one — which is why the site can move to
  a new domain without the API being reconfigured.
- It passes back the status, the body, `content-type`, `cache-control` and every `set-cookie`.
- `API_URL` is read on each request, so it can change without a rebuild.

Browser code uses `lib/api.ts`: `api.get/post/put/patch/delete`. A failure is an `ApiError`
with `status`, `code` and `fields`. Show `error(code)` from `useI18n()`; show a field's code
next to the field.

## Arriving on a screen

The API is far away, and a guest opens this in a queue. A screen must arrive **in one step**:
its content, or one placeholder and then its content. Never one placeholder after another,
never a spinner, never the word "loading". Four things make that so, and each needs the others
([BUG-0004](../bugs/0004-a-screen-shows-two-placeholders-before-its-content.md)):

1. **The page brings the first answer with it.** Each `page.tsx` fetches its screen's data on
   the server, together with the sign-in check, and hands it to the screen as `first`:

   ```tsx
   const [, first] = await Promise.all([requireMe("/pass"), firstAnswer<TonightResponse>("/pass/tonight")]);
   return <PassScreen first={first} />;
   ```

   `Promise.all`, not one after the other. `firstAnswer` (`lib/server-api.ts`) returns null if
   the API refuses or is slow; the screen then asks for itself.
2. **A screen remembers its last answer** (`lib/live-store.ts`, read through `useLive`). Coming
   back to a tab shows what was there, at once, and asks again behind it. What the phone last
   heard wins over what came with the page: the page may have been fetched ahead minutes ago,
   before the member pressed a button on that very screen.
3. **The dock has every tab in hand.** Its links are `prefetch` (the whole page, not only the
   placeholder), and it asks again every 20 seconds, which costs nothing while the copy is
   fresh and replaces it soon after it goes stale (five minutes). A tap then shows the screen
   with no request: 60–125 ms.
4. **One placeholder per screen.** Each screen exports its own (`PassSkeleton`,
   `InvitesSkeleton`, `DoorSkeleton`, `AdminSkeleton`), used by the route's `loading.tsx` and
   by the screen itself when it has no data. Whatever needs nothing from the server is drawn
   for real: the frame of the door and of the back office, a screen's title, the whole profile.

When a tab is tapped before its page is in hand, the screen being left steps back (`.leaving`)
so the tap is plainly answered, and the dock's marker has already moved.

**`next dev` does not prefetch.** Point 3 cannot be seen in development or in the ordinary
end-to-end run. `node e2e/warm-tabs.mjs` measures it against a production build
(`pnpm build && pnpm exec next start`) or the live site.

## Live data

There are no websockets. A screen that must stay current reads its data with `useLive`
(`components/use-live.ts`), which asks on arrival and then on an interval, only while the tab
is visible:

```tsx
const { data, failure, reload, set } = useLive<TonightResponse>("/pass/tonight", { every: 4000, first });
```

- `set` puts the reply to a button on screen at once. A poll that was already on its way is
  then dropped: it describes the moment before.
- **A failure is not news until it lasts**
  ([BUG-0005](../bugs/0005-one-failed-refresh-puts-a-red-box-on-a-working-screen.md)). A failed
  request is tried again twice before anyone is told. A screen that has its content reports a
  failure only when asking has failed twice running, and keeps its content either way. A
  refusal (403, 404, 429) is an answer and is not retried.
- An answer nobody is looking at is kept for five minutes. One that is on screen is kept for
  as long as it is on screen — a pass held up in a basement must not vanish.
- **Nothing is written to the store while rendering on the server.** There the module is
  shared by every visitor.

How often each screen asks:

| Screen | Every | Why |
|---|---|---|
| pass | 4 s | to flip to "admitted", and to notice an approval |
| invite link, door ticket | 5–6 s | to flip to "admitted" |
| invites | 8 s | answers to sent invites |
| door counters | 6 s | inside / turned away |
| admin overview, requests | 10–15 s | new requests |
| an admin's account, from the dock | 30 s | the count of requests waiting, on every screen |

## SEO

`lib/site-meta.ts` builds the metadata for public pages: title, description, canonical,
`hreflang` alternates, Open Graph. The home-screen manifest is served by route handlers, not a `manifest.ts` file: file-based
metadata cannot be overridden per page, and an invite or a door ticket must save to the home
screen as *itself* (`lib/web-manifest.ts`). `sitemap.ts` lists the public pages with their language
alternates. `robots.ts` allows only those. App pages carry `noindex`. The landing page embeds
`BarOrPub` structured data.

## Watch out

- **`venue.url` must be the real public address** for canonical links and the sitemap. Set
  `NEXT_PUBLIC_SITE_URL` when the bar has its own domain.
- **A new public page needs both languages:** a page under `(ka)` and one under `(en)/en`, and
  an entry in `sitemap.ts` and `robots.ts`.
- **Do not read cookies or headers in `(ka)` or `(en)`.** It silently makes the page dynamic.
