# BUG-0003: A full-screen sheet at the door leaves the dock on top of it

**Status:** Fixed   **Severity:** SEV3   **Date:** 2026-10-13
**Reporter:** found while measuring page loading   **Area:** door, navigation

## Symptom
Staff open a result or the "ticket at the door" form. The sheet does not fill the screen. It
is as tall as the page above the dock, it scrolls with the page, and the dock stays visible and
tappable under the thumb. One stray tap on the dock leaves a decision half made. It affects
every sheet on every signed-in screen, on every phone. The "save to phone" sheet is affected
the same way.

## Reproduce
1. Sign in as door staff. Open `/door`.
2. Tap "Ticket at the door".
3. Look at the bottom of the screen.
- **Expected:** the form covers the whole screen, the dock included.   **Actual:** the dock is on top; the form starts 88px above the screen.

## Root cause (5 Whys)
1. Why is the sheet not on the window? A `position: fixed` element is placed against the
   nearest ancestor that has a transform. The sheet has such an ancestor.
2. Why does an ancestor have a transform? Each screen is wrapped in `.page-in`, which eases
   the screen in with `translateY`.
3. Why is the transform still there after the animation? The animation ran with
   `animation-fill-mode: both` and ended on `transform: translateY(0)`. A transform that moves
   nothing is still a transform (`src/app/globals.css`, `@keyframes page-in`).
4. Why did the dock end up above? The same transform makes a new stacking context. The sheet's
   `z-index` then only counts inside the screen, and the dock is outside it.
5. Why did no test catch it? The end-to-end tests clicked the buttons inside the sheet, which
   still worked. **Nothing checked that a sheet covers the screen — the one property that makes
   it a sheet.**

## Workaround
None for staff. Scrolling to the top of the page brings the sheet's first fields into view.

## Fix
`page-in` now only says where the screen starts from, and ends as the screen itself is — with
no transform left behind (`animation-fill-mode: backwards`, no `to` keyframe).

## Regression test
`e2e/loading.spec.ts` › "a sheet at the door covers the whole screen, the dock included". It
measures the sheet against the window and asks what is under the thumb. The live site, which
still ran the old stylesheet, failed the same measurement: sheet at `y = -88`, dock under the
thumb.

## Links
- Rule added: `docs/domains/design.md` → "Rules", no transform may outlive an animation on anything that wraps a screen.
