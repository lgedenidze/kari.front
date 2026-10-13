# BUG-0002: The door scanner reads the same pass twice

**Status:** Fixed   **Severity:** SEV3   **Date:** 2026-10-13
**Reporter:** owner, testing the door on an iPhone   **Area:** door

## Symptom
Staff scan a guest's pass and tap Admit. The scanner returns and at once shows the same guest
again, as "Already inside". It affects every scan where the guest's phone is still held up when
the decision is made — which is most of them. Staff must dismiss a second result for each
guest, and the door log gains a re-entry for someone who never left.

## Reproduce
1. Open the door scanner.
2. Hold a live pass in front of the camera. The result opens.
3. Keep the pass in front of the camera. Wait five seconds. Tap Admit.
- **Expected:** the scanner waits for the next guest.   **Actual:** it reads the same pass again and opens "Already inside".

## Root cause (5 Whys)
1. Why is the pass read again? The scanner starts reading the moment the result closes, and the
   pass is still in the frame.
2. Why does it not know it has just read that pass? Its only guard was "ignore the same text
   for four seconds" (`REPEAT_AFTER_MS`). A decision takes longer than four seconds.
3. Why a timer? The guard was written against the camera reporting one code many times a
   second. It did not consider the pause while a result is on screen.
4. Why was the pause not considered? During the pause no frames are read, so to the guard the
   pass looked long gone.
5. Why did no test catch it? The rule lived inside the camera component and could not be
   tested without a camera. **A scanner's "have I read this already" rule was a time-out, not
   a model of the code being present, and it was untestable where it sat.**

A second, quieter fault followed from the same guard: it compared the QR's whole text. A pass
shows a new code every thirty seconds, so a pass held up across a change was a "different" code.

## Workaround
Ask the guest to lower their phone before tapping Admit.

## Fix
The rule is now "one read per showing", in `src/lib/scan-presence.ts`: a code is read once,
and to be read again it must be out of the frame for 1.5 seconds and come back. A pass is
identified by its id, not by the code it is showing. When reading resumes after a result, the
pass just decided is counted as still present. The scanner also says "checking…" the instant
it reads a code, shows a notice instead of a full-screen result for a QR that is not a pass,
keeps the screen awake, restarts the camera when the phone takes it away, and offers a torch
where the device has one.

## Regression test
`src/lib/scan-presence.test.ts::does not read the pass again when staff decide and the phone is
still held up`. Run against the old four-second rule it counts two reads of one showing; the
test demands one.

## Links
- Domain page: `docs/domains/door-and-admin.md` → Scanning.
