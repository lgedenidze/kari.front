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
| `NightPicker` | `components/night-picker.tsx` | The two-week calendar. |
| icons | `components/icons.tsx` | The app's own icons: ticket, invite, viewfinder, rubber stamp, person-in-ring. |
| `Field`, `FormError` | `components/field.tsx` | A labelled input wired to its hint and error. |

CSS classes worth knowing: `.btn` with `.btn-paper` (main action on ink), `.btn-ink` (main
action on paper), `.btn-line`, `.btn-go`, `.btn-stop`, `.btn-big`; `.paper`; `.ticket` and
`.ticket-tear`; `.chip`; `.input`, `.label`, `.hint`, `.field-error`.

## The dock

One navigation for the whole app. A member sees Pass, Invites, Profile. Staff also get Door. An
admin also gets Office. The same dock is on the door and admin screens, so every place is one
tap from every other.

The current place is a paper ticket stub (`.tab-stub`) with the same side notches as every
ticket. It slides to the tab that is tapped. A result or a form at the door covers the dock, so
nobody leaves a decision by accident.

## Rules

1. **Never put a stamp or anything else over a QR code.** Stamps land beside the name.
2. **A ticket sits on a flat ground.** Its notches are discs in the ground's colour. On a
   ground that is not ink, set `--ground` on a parent.
3. **Forms are always on paper or desk,** never straight on ink.
4. **One orchestrated motion per screen.** The stamp thump is it. No fade-ins on scroll.
   `prefers-reduced-motion` turns motion off.
5. **Everything works at 360px wide,** with no sideways scroll. A `fieldset` needs `min-w-0`
   before its content can shrink.
6. **Tap targets are at least 44px.** Inputs are 16px so iOS does not zoom.
7. **Focus is always visible** — a 2px outline in the text colour.
8. **Meaning never rests on colour alone.** A verdict band has a word; a chip has a label.
9. **Icons are drawn here, in the app's vocabulary.** Do not add an icon library.

## The Wox credit

The app doubles as marketing for Wox, quietly. Present placements:

- the landing header — the bar's name × the Wox wordmark (`WoxLogo`, Wox's own artwork used as a mask);
- the hero — a pale "WOX.GE" maker's seal beside the ticket;
- the foot of the landing page, and a second seal by the closing button;
- the stub of every pass and ticket (`WoxCredit`, with the real Wox mark);
- under the sign-up and sign-in forms; the foot of the door and admin screens.

The bar's name is always larger and louder. Do not add the credit inside the scanner's result
sheet or over a ticket's name.

## Renaming the venue

`src/venue.ts` is the only place: `name`, `nameKa`, `kind`, `city`, `address`. The stamp ring,
the wordmark, the metadata and the manifest all read from it.
