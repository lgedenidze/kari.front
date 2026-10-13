# BUG-0001: Dates render in English inside the Georgian interface

**Status:** Fixed   **Severity:** SEV3   **Date:** 2026-10-13
**Reporter:** owner, from a screenshot of the invites page   **Area:** i18n

## Symptom
The interface is in Georgian, but dates are in English. The night picker on the invites page
shows "Mon, Oct 12" where it must show "ორშ, 12 ოქტ". It affects every guest who uses Chrome
with the Georgian interface, on every screen that prints a date: the pass, invites, the door
log, the back office. The landing page is not affected.

## Reproduce
1. Open the app in Chrome with the language set to Georgian.
2. Sign in as a member who may invite.
3. Open Invites and look at the night picker.
- **Expected:** "ორშ, 12 ოქტ"   **Actual:** "Mon, Oct 12"

## Root cause (5 Whys)
1. Why are the dates in English? `Intl.DateTimeFormat("ka-GE")` returns English text in Chrome.
2. Why does it return English? Chrome ships no Georgian date data. It falls back to its default
   locale without an error.
3. Why did the landing page look right? It is rendered on the server. Node has full ICU data
   and answers in Georgian.
4. Why did no test catch it? The unit tests run in Node, which has the data. They saw Georgian.
5. Why did the code trust the runtime? `formatNight` in `src/i18n/index.ts` took day and month
   names from `Intl`. **No rule said that locale data differs between server and browser, and
   no test pinned the output without it.**

The same difference also produced a hydration mismatch on client components that print a date.

## Workaround
Use the English interface.

## Fix
`src/i18n/index.ts` now holds its own Georgian and English day and month names. `formatNight`,
`formatDateTime` and `formatDate` build their text from those tables. `Intl` is asked only for
numbers, in `en-GB`, which every browser has.

## Regression test
`src/i18n/format.test.ts::never asks the runtime for Georgian date data`. It replaces
`Intl.DateTimeFormat` with one that throws when asked for Georgian. The old code throws. The new
code passes. A plain output test could not serve: Node would have passed it before the fix too.

## Links
- Rule added: `CLAUDE.md` → "Never ask `Intl` for Georgian."
- Domain page: `docs/domains/structure.md` → Language.
