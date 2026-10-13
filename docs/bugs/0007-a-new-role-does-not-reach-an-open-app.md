# BUG-0007: A new role does not reach an app that is already open

**Status:** Fixed   **Severity:** SEV3   **Date:** 2026-10-13
**Reporter:** owner ("i changed guy's profile and still shows as staff")   **Area:** frontend — the dock, every signed-in screen

## Symptom
An admin changes a person in the back office: makes door staff an admin, or a member door
staff. The API saves it. The person's phone, with the app open, keeps the dock it had. Door
staff made an admin still has no Office tab. A member made door staff has no Door tab. It stays
so until the person signs in again or loads the page afresh. The same held for an invite sent
to a member: the count on their Invites tab did not appear.

## Reproduce
1. Sign in as a member on one phone. Leave the app open on the pass.
2. On another phone, as an admin, open that person in People and set the role to door staff.
3. Look at the first phone. Wait. Tap between its tabs.
- **Expected:** the Door tab appears in the dock within half a minute.
- **Actual:** the dock never changes.

## Root cause (5 Whys)
1. Why did the dock not change? It draws from the account held in `MeProvider`, and that
   account was never read again.
2. Why not? `SharedDock` polled it only for an admin:
   `usePoll(refresh, 30_000, me.role === "admin")`
   (`src/app/(app)/(signed)/signed-chrome.tsx`).
3. Why only for an admin? The poll was added for one number, the requests waiting, which only
   an admin has. It was written as that number's poll, not as the account's.
4. Why did a move to another screen not bring the new account? The signed-in layout is made
   once and kept; Next.js does not make a layout again on a move between its pages.
5. Why did no test catch it? **Every test changed a person first and opened their app after.
   None changed a person while that person's app was open.**

## Workaround
The person closes the app and opens it again, or reloads the page.

## Fix
Every signed-in app reads its account again every 30 seconds, on every move to another screen
and on coming back into view. When the role or the status has changed, the open page is made
again on the server, which sends a person who has lost the door or the office to their pass.

## Regression test
`e2e/flow.spec.ts` › "what the bar changes about a person reaches the app they already have
open". An admin sets a member to door staff, then admin, then member, while that person's app
is open. The dock follows each time, and the person is taken off the door screen when it stops
being theirs. Before the fix it failed at the first step: the Door tab never appeared.

## Links
- Domain: `docs/domains/door-and-admin.md` → "A person".
