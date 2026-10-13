# Design

The app belongs to the bar. It must not look like Wox, and it must not look like every other
nightlife app (black with one neon accent).

## The idea

**Two materials: stamp ink and cloakroom-ticket paper.**

- The ground is ink — a deep cobalt, not black.
- Anything a guest holds is paper laid on it: a pass, an invite, a form.
- Every status is a round door stamp: verified, admitted, denied, in review, void.

There is a practical reason under it. A pass is bright paper because that is what a scanner
reads best. The ground stays dark so a phone held up in a queue does not light the street.

## Tokens

All in `src/app/globals.css` under `@theme`.

| Token | Value | For |
|---|---|---|
| `ink` | `#14235e` | the ground |
| `ink-deep` | `#0c1740` | the door screen, the dock |
| `ink-raised` / `ink-line` | `#1d2f78` / `#34489b` | raised surfaces and rules on ink |
| `ink-soft` | `#a9b6e6` | quiet text on ink (7:1) |
| `paper` | `#f4d4d7` | tickets, cards, the main button on ink |
| `paper-light` / `paper-line` | `#fbecee` / `#dfaab1` | text on ink; tear lines |
| `paper-soft` | `#4d5a8f` | quiet text on paper (5:1) |
| `qr` | `#fffafa` | the QR window and inputs — the whitest surface |
| `stamp-blue` / `-red` / `-green` | `#2447d8` / `#b3122e` / `#0b6b41` | stamp inks, for marks **on paper** |
| `go` / `stop` / `wait` | `#46d893` / `#ff6b7f` / `#ffc44d` | door signals, for marks **on ink** |
| `alert` | `#e5173f` | a count that wants an answer, **on ink**; white figures (4.6:1) |
| `desk` / `desk-line` / `desk-soft` | `#f7f4f5` / `#e3dcdf` / `#5f6480` | the back office only |

The palette is deliberately not Wox's purple. Only the dot in the Wox mark is purple.

## Type

One family, **Noto Sans Georgian**, loaded with its width axis. It covers Georgian and Latin, so
the two scripts never mismatch.

- Headlines (`h1`, `h2`, `.display`): condensed (`wdth 70`), weight 800, tight leading.
- Text: regular width.
- Codes read aloud at the door (`.code`): full width, heavy, letter-spaced.
- Numbers that change (`.tabular`): tabular figures.

Georgian has no capital letters. Do not build hierarchy on uppercase.

## Components

| Component | File | What |
|---|---|---|
| `TicketCard` | `components/ticket.tsx` | The paper ticket: name, night, a window, a tear line, a stub. |
| `LiveTicket` | `components/live-ticket.tsx` | A ticket with the rotating QR. See [tickets.md](tickets.md). |
| `Stamp` | `components/stamp.tsx` | A round stamp with a word across it. Inks: blue, green, red, grey, paper. |
| `Dock` | `components/app-chrome.tsx` | The floating navigation on every signed-in screen. |
| `Count` | `components/count.tsx` | A red mark with a white number: something is waiting for an answer. See "The dock". |
| `NightPicker` | `components/night-picker.tsx` | One row of the nights the bar is open, to tap. A named night is a small ticket: the date is its stub, the name is beside it. See tickets.md, "Inviting a guest". |
| `ReturnAction` | `components/return-action.tsx` | The landing page's one action, which changes for someone this phone already knows. See structure.md, "Someone who comes back". |
| icons | `components/icons.tsx` | The app's own icons: ticket, invite, viewfinder, rubber stamp, person-in-ring. |
| `Field`, `FormError` | `components/field.tsx` | A labelled input wired to its hint and error. A password field can be looked at before it is sent: there is no second field to catch a slip, and no "forgot password". `FieldLabel` puts "optional" at the far end of the label's line. `useFirstMistake` takes a form that came back with mistakes to the first one; `FormError` brings itself into view. |
| `Face` | `components/face.tsx` | A person's photo from the API. A photo that will not load leaves nothing behind — never the browser's broken-picture mark. |
| `TicketSkeleton`, `RowsSkeleton` | `components/loading.tsx` | The one material for "not here yet": a quiet block with a light sweeping across. See structure.md, "Arriving on a screen". |

CSS classes worth knowing: `.btn` with `.btn-paper` (main action on ink), `.btn-ink` (main
action on paper), `.btn-line`, `.btn-go`, `.btn-stop`, `.btn-big`; `.paper`; `.ticket` and
`.ticket-tear`; `.chip`; `.input`, `.label`, `.hint`, `.field-error`.

## The dock

One navigation for the whole app. A member sees Pass, Invites, Profile. Staff also get Door. An
admin also gets Office. The same dock is on the door and admin screens, so every place is one
tap from every other.

The current place is a paper ticket stub (`.tab-stub`) with the same side notches as every
ticket. It slides to the tab that is tapped — at once, before the page has arrived. The dock is
built once, in `(signed)/layout.tsx`, and never unmounts; that is what lets it slide. A result or a form at the door covers the dock, so
nobody leaves a decision by accident.

A tab with something waiting behind it carries a count (`Count`, `.count`): invites to answer on
Invites, and for an admin the requests to join on Office. The same count sits on the Requests
tab of the back office. It is red with white figures on every ground — `alert` on ink,
`stamp-red` on the stub and on the desk — with a rim in the ground's colour. Nothing is drawn
at zero, and "99+" stands for anything larger than 99. The number a screen arrives with does
not move. A change after that lands with one thump and one ring (`.count-thump`), and then
the mark keeps still: it never pulses.

## Rules

1. **Never put a stamp or anything else over a QR code.** Stamps land beside the name.
2. **A ticket sits on a flat ground.** Its notches are discs in the ground's colour. On a
   ground that is not ink, set `--ground` on a parent.
3. **Forms are always on paper or desk,** never straight on ink.
4. **One orchestrated motion per screen.** The stamp thump is it. No fade-ins on scroll.
   `prefers-reduced-motion` turns motion off. A screen eases in once, as a whole (`.page-in`);
   nothing inside it rises again. `.rise` is for what appears because of a tap: a sheet, a
   form opened by a button.
5. **Everything works at 360px wide,** with no sideways scroll. A `fieldset` needs `min-w-0`
   before its content can shrink.
6. **Tap targets are at least 44px.** Inputs are 16px so iOS does not zoom.
7. **Focus is always visible** — a 2px outline in the text colour.
8. **Meaning never rests on colour alone.** A verdict band has a word; a chip has a label.
9. **Icons are drawn here, in the app's vocabulary.** Do not add an icon library.
10. **Nothing that wraps a screen may keep a transform.** A transform — even one that moves
    nothing — makes every `position: fixed` sheet inside it sit in the screen instead of the
    window, with the dock on top
    ([BUG-0003](../bugs/0003-a-sheet-at-the-door-leaves-the-dock-on-top.md)). An entrance
    animation says where it starts and ends as the element itself is.
11. **An error state offers the way out as a button.** "No camera — find the guest by name"
    comes with the Find button, not only the sentence.
12. **A failed tap is answered where the eye is.** A form is sent from its last line, and the
    field that needs fixing is often a screen above it. `useFirstMistake` goes to that field;
    a failure of the whole request brings its notice into view.
13. **A no is asked for twice; a yes is not.** Rejecting a request, cancelling an invite and
    deleting a night each take a second tap, in place. Approving, admitting and creating do not.
14. **A row that opens something is the button.** A person, a night in the schedule, a line of
    the profile, a record in the door's list: the whole row is tapped. Not a row with an
    "Edit" button in it.
15. **What a form needs first comes first, and what it may need is folded away.** Inviting is
    a name, a night and a button, in view at once. The personal number and the phone are one
    tap away, and unfold by themselves when the API finds a mistake in one.
16. **When there is advice, the advised answer is the filled button.** At the door both
    answers are always one tap and never change places; the one the scanner advises is filled
    and the other is an outline. With no advice, both are filled.
17. **Closed and empty say what comes next.** A closed night names the next open one. A night
    with no invites left can still be tapped, and says so.
18. **A switch does what it shows, at once.** In the back office, a role, a permission and
    a status are saved by the tap that changes them, and the page says "Saved" in one fixed
    place. Only what is typed has a Save button. Nothing is earned or counted towards: a
    permission is on or off, and an admin sets it.
19. **Things of one kind sit in one place.** In a row of dates every date is the same block
    in the same position; what one of them has extra — a night's name — goes beside it, not
    under it where it would push that date out of line.

## Words

The screens were cut to the words that are needed (2026-10-13, on the owner's instruction:
"remove unnecessary texts"). Keep them that way.

- **A screen explains itself by what is on it.** No paragraph under a title saying what the
  title said. A form has a title and its fields.
- **A field gets a hint only when the hint changes what is typed:** which name (the one on the
  ID), what to put for a profile, how long a password must be. Never "you will sign in
  with this number".
- **An empty list gets no heading and no sentence.** "For you" appears on Invites when there is
  an invite; "No nights yet" is not said at all. The exception is an empty state that is the
  whole screen (no requests waiting), which gets one short line.
- **A name is two fields on one line,** on a phone too.
- **"Optional" is one small word at the end of the label's line,** not a bracket after it.
- **Never say the same word twice in one row** — a search result that reads "Member" under the
  name does not also carry a "Member" chip.
- Everything a button does is still said on the button, and every error keeps its full sentence.

## The Wox credit

The app doubles as marketing for Wox, quietly. Present placements:

- the landing header — the bar's name with the Wox wordmark (`WoxLogo`, Wox's own artwork used
  as a mask): stacked as "powered by WOX" on a phone, side by side with a × from a tablet up;
- the hero — a pale "WOX.GE" maker's seal: beside the headline on phones and tablets (floated
  with a round outline so the headline runs round it), beside the ticket on wide screens;
- the foot of the landing page, and a second seal by the closing button;
- the stub of every pass and ticket (`WoxCredit`, with the real Wox mark);
- under the sign-up and sign-in forms; the foot of the door and admin screens.

The bar's name is always larger and louder. Do not add the credit inside the scanner's result
sheet or over a ticket's name.

## Renaming the venue

`src/venue.ts` is the only place: `name`, `nameKa`, `kind`, `city`, `address`. The stamp ring,
the wordmark, the metadata, the manifest and the name of a downloaded ticket all read from it.
It is KARI (კარი) since 2026-10-13; it was the working name NISLI before.
