# BUG-0005: One failed refresh puts a red error box on a screen that is working

**Status:** Fixed   **Severity:** SEV3   **Date:** 2026-10-13
**Reporter:** owner ("sometimes showing that too")   **Area:** every screen that keeps itself current

## Symptom
A member is looking at their invites. A red box appears above them: "Something went wrong on
our side. Try again." Nothing is wrong with what is on screen, and the box goes away by itself
a few seconds later. It appears now and then, on any screen that refreshes in the background.

## Reproduce
1. Sign in. Open `/invites`. Wait for the list.
2. Make one request to `/api/invites` fail with a 500 (a proxy rule, or a moment of no signal).
- **Expected:** the list stays; nothing is said.   **Actual:** a red box sits above the list until the next refresh, eight seconds later.

## Root cause (5 Whys)
1. Why a red box? A background refresh failed, and the screen showed the failure.
2. Why show it when the screen still had its content? The screen had one failure slot, shared
   by "the page could not load" and "one refresh in the background did not come back".
3. Why was the request not simply tried again? Each screen made one attempt per poll.
4. Why do requests fail at all? The API and its database are far away and can have a bad
   moment: a network hop, a cold start, a dropped database connection.
5. Why was this not seen before release? Every test ran against a server on the same machine,
   which never fails. **A passing failure and a lasting one were treated as the same event,
   and no test injected either.**

## Workaround
Wait a few seconds. The box clears on the next refresh.

## Fix
`useLive` (`src/components/use-live.ts`) and `askPatiently` (`src/lib/live-store.ts`):
- a request that fails is tried again twice, 0.6 s and 1.4 s later, before anyone is told;
- a refusal (401, 403, 404, 429) is an answer and is not retried;
- a screen that has its content reports a failure only when asking has failed twice running,
  and keeps its content either way.

## Regression test
- `src/lib/live-store.test.ts` › "asking with patience" (three cases).
- `e2e/loading.spec.ts` › "a refresh that fails once says nothing; one that keeps failing does,
  and the screen keeps its content".

## Links
- Rules: `docs/domains/structure.md` → "Live data".
- Related: [BUG-0004](0004-a-screen-shows-two-placeholders-before-its-content.md).
