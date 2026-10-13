# BUG-0006: A named night runs under its hours in the schedule, on a phone

**Status:** Fixed   **Severity:** SEV4   **Date:** 2026-10-13
**Reporter:** session (phone audit at 360px)   **Area:** frontend — back office, Nights

## Symptom
An admin opens Nights on a phone. In "The next three weeks", every row breaks its date into
three lines. A night that has a name is worse: the name wraps under the hours chip, runs into
it, and is cut off in the middle of a word. The row is hard to read and looks broken.

## Reproduce
1. Sign in as an admin on a phone, or at 360px wide.
2. Open the back office, then Nights.
3. Add a night with a name and a note. Find it in "The next three weeks".
- **Expected:** one row, two lines: the date with the name, then the hours and the note.
- **Actual:** a row four lines tall; the name overlaps the hours chip.

## Root cause (5 Whys)
1. Why did the name overlap? The text column was about 60px wide, so each word took a line,
   and the note was laid over the chip beside it.
2. Why 60px? The chip and the "Edit" button were set never to shrink, and together they took
   about 235px of a 300px row (`src/app/(app)/(signed)/admin/nights.tsx`, the schedule list).
3. Why was the long date used? One format ("Tuesday, 13 October") served every width. The
   overview table had already been given the short one for phones; this list had not.
4. Why did the phone audit not report it? The audit reports a page that scrolls sideways.
   This row did not: it wrapped, inside the page's width.
5. Why did no test catch it? **No test measured a row on a phone. Layout on a phone was
   checked by looking at pictures, and nobody had looked at this list with a named night in it.**

## Workaround
Turn the phone sideways, or read the same night in "Named and changed nights" above the list.

## Fix
The row is a button that opens the night, with an arrow, as a person's row opens the person.
It has two lines that are never wrapped: the date (the short one on a phone) with the name,
then the hours and the note. The chip and the per-row "Edit" button are gone.

## Regression test
`e2e/flow.spec.ts` › "an admin names a night, and members see it by name" — the named night's
row in the schedule is less than 80px tall at phone size. Before the fix it measured 98.6px
and the test failed; after, it passes.

## Links
- Rule: `docs/domains/design.md` → Rules 5 and 14.
