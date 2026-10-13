# BUG-0004: A screen shows two placeholders, then the word "loading", before its content

**Status:** Fixed   **Severity:** SEV3   **Date:** 2026-10-13
**Reporter:** owner, testing on an iPhone   **Area:** navigation, every signed-in screen

## Symptom
A member taps a tab. The screen shows one placeholder, then a different one or the bare word
"იტვირთება…", and only then its content. Each screen does this differently: the pass shows two
ticket outlines of different sizes, invites show rows and then the word, the door and the back
office show a spinner with the word and then the word again. It affects every tab switch for
everyone. The owner's words: "so many things go… then იტვირთება, that's horrible, two loading
things".

## Reproduce
1. Sign in. Open `/pass`.
2. Slow the connection (the API is on another continent, so no throttling is needed in Tbilisi).
3. Tap "Invites".
- **Expected:** the invites, or one placeholder and then the invites.   **Actual:** rows, then "იტვირთება…", then the invites.

## Root cause (5 Whys)
1. Why two stages? A tab switch made two trips, one after the other. The first asked the
   server who is signed in. The second, started only after the first returned, fetched the
   screen's data.
2. Why were they shown differently? Each trip had its own placeholder, written at a different
   time: the route's `loading.tsx` for the first, a line inside the screen for the second.
3. Why did the screen fetch its own data at all? Every screen was a client component that
   mounted empty and asked. The page that rendered it already had the visitor's cookies and
   could have asked in the same trip.
4. Why did it happen again on every visit? Nothing remembered what a screen had shown. Leaving
   a tab threw its data away.
5. Why did nobody see it while building? On the developer's machine both trips take a few
   milliseconds. **No test ever looked at a screen on a slow connection, so the states a real
   guest sits through were never on anyone's screen.**

## Workaround
None.

## Fix
- Each page fetches its screen's first answer on the server, together with the sign-in check
  (`firstAnswer` in `src/lib/server-api.ts`). The screen mounts already filled in.
- Each screen keeps its last answer for as long as the app is open (`src/lib/live-store.ts`,
  `useLive`). Coming back to a tab shows it at once and asks again behind it.
- The dock fetches every tab ahead, in full, and keeps the copies fresh. A tap then shows the
  screen with no request at all: 60–125 ms measured, with the server slowed by 1.2 s.
- Each screen has one placeholder, used both by its `loading.tsx` and by the screen itself.
  The spinner and every visible "loading" are gone.

## Regression test
`e2e/loading.spec.ts`, which slows every answer from the server:
- "a screen arrives in one step: no waiting word, and never one placeholder after another";
- "the back office changes tab without a waiting word, and remembers a tab it has shown";
- "coming back to a tab shows what it last showed, not the state from before".

The first two failed on the old code ("/invites showed a waiting word").

## Links
- Rules: `docs/domains/structure.md` → "Arriving on a screen".
- Related: [BUG-0005](0005-one-failed-refresh-puts-a-red-box-on-a-working-screen.md).
