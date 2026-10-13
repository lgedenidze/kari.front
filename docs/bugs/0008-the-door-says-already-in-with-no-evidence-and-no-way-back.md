# BUG-0008: The door says "already in" about a guest who is not, with no evidence and no way back

**Status:** Fixed   **Severity:** SEV3   **Date:** 2026-10-14
**Reporter:** owner ("he isn't entered but showing us, that kind of bugs should never happen")   **Area:** frontend and backend — the door's result sheet, `POST /door/undo`

## Symptom
Door staff scan a guest's ticket. The sheet says "უკვე შემოსულია" (already in), "came in at
23:02". The guest has not come in. On the same card the sheet says "პირველად არის აქ" (first
time here). The sheet does not say who let the guest in. Its two buttons are Deny and Admit.
Staff tap Deny and pick "Other". The log gains a refusal against the guest. The next scan
still says "already in", and the counter still counts the guest as inside.

## Reproduce
1. As door staff, scan a guest's live ticket and tap Admit. Do it as a test, or by a slip.
2. An hour later, scan the same guest's ticket again.
- **Expected:** the door shows who let the guest in and when, and offers a way to say the
  guest is not in.
- **Actual:** "already in, came in at 23:02", "first time here", Deny and Admit.

## Root cause (5 Whys)
1. Why did the door say "already in"? The pass had `first_admitted_at` set. The log has the
   row: 23:02:07, admitted, verdict ok, method scan, by the shared test login. The door
   reported its data correctly.
2. Why did nobody know the admission was there? Its only receipt was a stamp on screen for
   one second. The sheet that later reported it gave the time and nothing else: not the
   member of staff, not the method (`PassCard` carried `admittedAt` only).
3. Why could staff not put it right? `first_admitted_at` was only ever set
   (`api/…/Door/DoorEndpoints.cs`, `Decide`). Nothing cleared it. Deny writes a row and
   changes nothing about the pass.
4. Why did the card say "first time here" under "already in"? A guest with no account has no
   counted nights. The API sends 0. The sheet read 0 as "first time"
   (`door-screen.tsx`, the visits chip).
5. Why did no test catch it? **Every test admitted the right person, on purpose. None admitted
   by mistake, and none read the "already in" sheet for what it claims.** The design had no
   answer to a wrong Admit, the one tap at the door that changes state.

## Workaround
Tap Admit on the "already in" sheet. The guest gets in. The log and the counter stay wrong.

## Fix
- The door can take an admission back (`POST /api/door/undo`). The pass is not let in again,
  the log gains an "undone" row, and the admission's own row stays. The result sheet offers it
  as a third answer, "Mistake, they are not in", whenever tonight's pass is in. The sheet then
  shows the same person, read afresh.
- "Already in" shows its evidence: the time, the member of staff, and "by hand" where the
  person was not scanned.
- The last decision made on a phone stays under the scanner until the next one. A first
  admission has "Mistake" beside it there.
- The nights chip is shown for an account only. A guest with no account gets no guess.
- A pass reached by hand no longer claims "live code".
- Visits and the back office's nightly numbers are read off the passes that were let in, so an
  admission taken back is not a visit.

## Regression test
- `e2e/flow.spec.ts` › "the door says who let someone in, and takes back an admission made by
  mistake". Before the fix it failed at its first check of the sheet: no "Let in by", and
  "First time here" on the card.
- `api/tests/Kari.Api.Tests/Api/EntryFlowTests.cs` ›
  `An_admission_made_by_mistake_is_taken_back_and_the_door_says_whose_it_was`. Before the fix
  there was no such endpoint.

## Links
- Domain: `docs/domains/door-and-admin.md` → "The result sheet", "The receipt".
- API: `api/docs/domains/door.md`, rules 8 and 9.
- The shared test login made the log name "Door Admin" on every row. That is a property of
  the test data, not a defect: each member of staff needs a login of their own.
