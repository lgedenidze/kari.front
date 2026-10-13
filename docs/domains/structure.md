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
  else Georgian. The toggle (`LangToggle`) sets the cookie and refreshes.
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
- `(member)/layout.tsx` wraps pass, invites and profile in the dock. It does not redirect; each
  page calls `requireMe` with its own path so the visitor returns to exactly that page.
- `/login` only ever redirects to a path on this site (`safeNext`).
- Client components get the account from `useMe()` (`components/me.tsx`).

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

## Live data

There are no websockets. Screens that must stay current poll with `usePoll` (`components/me.tsx`),
which only runs while the tab is visible:

| Screen | Every | Why |
|---|---|---|
| pass | 4 s | to flip to "admitted", and to notice an approval |
| invite link, door ticket | 5–6 s | to flip to "admitted" |
| invites | 8 s | answers to sent invites |
| door counters | 6 s | inside / turned away |
| admin overview, requests | 10–15 s | new requests |

## SEO

`lib/site-meta.ts` builds the metadata for public pages: title, description, canonical,
`hreflang` alternates, Open Graph. `sitemap.ts` lists the public pages with their language
alternates. `robots.ts` allows only those. App pages carry `noindex`. The landing page embeds
`BarOrPub` structured data.

## Watch out

- **`venue.url` must be the real public address** for canonical links and the sitemap. Set
  `NEXT_PUBLIC_SITE_URL` when the bar has its own domain.
- **A new public page needs both languages:** a page under `(ka)` and one under `(en)/en`, and
  an entry in `sitemap.ts` and `robots.ts`.
- **Do not read cookies or headers in `(ka)` or `(en)`.** It silently makes the page dynamic.
