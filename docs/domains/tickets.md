# Tickets

Everything a guest holds: the member's pass, an invite, a ticket from the door.

## One component, three ways in

`LiveTicket` (`components/live-ticket.tsx`) draws a pass. It is reached three ways:

| Route | Who | Data from |
|---|---|---|
| `/pass` | a signed-in member | `GET /api/pass/tonight` |
| `/i/[code]` | anyone holding an invite link — no account | `GET /api/invites/code/{code}` |
| `/t/[token]` | a walk-in holding a door ticket — no account | `GET /api/tickets/{token}` |

A pass is always issued to one named person for one night. The ticket shows that name large,
because the door compares it with an ID.

## The rotating QR

The QR is redrawn on the phone every 30 seconds. See `kari.back/docs/domains/nights-and-passes.md`
for the algorithm; this side of it is `lib/pass-code.ts`.

- The API sends the pass's **key** once, with its own clock (`serverTime`).
- `LiveTicket` keeps the difference between the server's clock and the phone's, and uses it for
  every code. Phones drift; the door checks against the server.
- A new code is computed only when the 30-second step changes. The tear line fills as the step
  runs out.
- It needs `crypto.subtle`, which browsers give only to https pages and localhost. Otherwise the
  ticket says so (`needsHttps`).
- It holds a screen wake lock while a code is showing, so the phone does not dim in the queue.

**`lib/pass-code.ts` and the API's `PassCode.cs` must agree byte for byte.**
`pass-code.test.ts` asserts the same key, steps and codes as the API's `PassCodeTests`. If you
touch either, change both and run both.

## What the ticket shows

| State | Shown |
|---|---|
| for tonight, active | the QR, "show this at the door", the countdown |
| admitted | the QR still (for re-entry), "you are in since 23:41", and a green stamp that lands once |
| revoked | "this ticket was cancelled" and a red VOID stamp |
| for a later night | "this ticket is for …; the code appears that night" |
| for a past night | "this ticket was for …" |

"Tonight" is the API's. The ticket compares `ticket.night` with the `tonight` the API sent; it
never works out the night itself.

The stamp lands beside the name. **Never on the QR.**

## The pass page

`(member)/pass/pass-screen.tsx`. What it shows depends on the account:

- a ticket for tonight, if there is one — whatever the account's status (a guest may hold one
  from an invite);
- `approved` and open tonight → the button to claim tonight's pass;
- `approved` and closed tonight → closed;
- `pending` → "your request is with the bar", with a grey stamp. The page polls and changes by
  itself when the bar answers;
- `rejected` → the bar's note, and a form to fix the Facebook link and ask again;
- `guest` → a form to ask for membership;
- `banned` → suspended.

Below: invites waiting, passes for coming nights, and the count of nights so far.

## Invites

`(member)/invites/invites-screen.tsx`.

- **For you** — invites addressed to this account. Accept, decline, or open the ticket.
- **From you** — if the member may invite: the form, then the list of sent invites with their
  state and a way to share or cancel each. If not: why not, and how many nights are left to earn it.
- After creating an invite the member sees its link as a QR (the guest can scan it off the
  member's screen) and a share button.

### The night calendar

`components/night-picker.tsx`. Two weeks, seven columns, Monday first.

- Every night is drawn. Open ones can be chosen. Closed ones are dashed and struck through.
  Used-up ones are greyed.
- Tonight is underlined. A named night carries a dot.
- Under the grid: the chosen night in full — date, its name, its note, invites left.
- Named nights are also listed by name under "Special nights", because a name is what people
  look for.

The API sends all fourteen nights in order (`InvitesOverview.nights`). The picker lays them out;
it does not generate dates.

## The invite link

`(app)/i/[code]/invite-screen.tsx`. No account is needed.

- Pending: the invite drawn as the ticket it will become, with Accept and Decline.
- Accepted: the live ticket, and "keep this page — it is your ticket".
- The personal number is masked here. The link can be forwarded.
- The member who sent it sees its state and a link to manage invites — never the guest's QR.

## Watch out

- **A failed poll must not wipe a ticket that is on screen.** Keep the last good data and show
  the error under it.
- **`Qr` sets `data-value`** to what it encodes. The end-to-end tests read it. It reveals
  nothing the QR does not already say.
- **Do not format dates with `Intl` in Georgian.** See [BUG-0001](../bugs/0001-georgian-dates-render-in-english.md).
