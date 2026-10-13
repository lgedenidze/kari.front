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

`(signed)/(member)/pass/pass-screen.tsx`. The pass comes with the page (`first`), so the screen
opens holding it; `PassSkeleton` is what shows when it does not. What it shows depends on the
account:

- a ticket for tonight, if there is one — whatever the account's status (a guest may hold one
  from an invite);
- `approved` and open tonight → the pass **before it is printed**: the same ticket, with the
  member's name and tonight on it, a dashed window where the code will be, and the button that
  prints it. A first visit shows what they are about to hold, not a paragraph about it;
- `approved` and closed tonight → the same ticket, saying closed, and when the next open night
  is. The coming week comes with the page (`getVenue`, the landing page's own copy);
- `pending` → "your request is with the bar", with a grey stamp, the three steps (sent, in
  review, pass), and the Facebook link that was sent — a link, so they can see it opens the
  right profile — with a way to change it. A mistyped link is the usual reason a request sits
  unanswered. The page polls and changes by itself when the bar answers;
- `rejected` → the bar's note, and a form to fix the Facebook link and ask again;
- `guest` → a form to ask for membership;
- `banned` → suspended.

Below: invites waiting, passes for coming nights, and the count of nights so far — once there
is a night to count.

## Inviting a guest

`(signed)/(member)/invites/invites-screen.tsx`. Rebuilt on 2026-10-13, on the owner's word that
the screen was hard to use.

Inviting is three things, in the order a member thinks of them: **who, which night, send.**

- **The form** is a name (two fields on one line), a row of nights and one button. All of it is
  in view on a 360px phone before anything is typed; a test holds it to that.
- **The row of nights** (`components/night-picker.tsx`) replaced a two-week calendar and a
  second list of named nights. Only nights the bar is open are on it, the nearest first.
  Tonight says "Today". A named night carries its name. A night with no invites left is there,
  struck through, and cannot be chosen. Under the row: the chosen night in full — date, name,
  note, invites left. The row scrolls sideways and fades at its far edge. The API sends the
  nights (`InvitesOverview.nights`); the row does not generate dates.
- **The personal number and the phone** are folded behind one line, "+ Personal number or
  phone". They unfold by themselves when the API finds a mistake in one.
- **What comes back is a sheet** over the whole screen: the guest's name, the night, the link
  as a QR to scan off the member's phone, and one large Share button. The invite is not done
  until the guest has it, so that is all there is until the member closes the sheet. Behind
  it the form is empty again. Sharing sends a line of words with the link — "Invite: NISLI,
  Fri 16 Oct" — so the guest's chat shows what it is.
- **Sent** — under the form: each invite with its state, Share, and Cancel (asked for twice).
- **For you** — above the form, only when there is an invite. Accept goes straight to the
  pass, where the ticket is. Decline is asked for twice: an invite cannot be accepted again.
- **Not allowed to invite yet** — a card that fills, one mark for each night been, and how
  many are left. A member the bar has switched inviting off for sees one line instead.

## The invite link

`(app)/i/[code]/invite-screen.tsx`. No account is needed. The invite is fetched with the page,
as a door ticket is: someone opening the link sees the ticket in the first paint, not an outline.

- Pending: the invite drawn as the ticket it will become — the same shape as a member's pass
  before it is claimed: a dashed window where the code will be, and in it the one button that
  prints it. The caption says when the doors are open that night. Under the ticket, a quiet
  "I can't come", which asks once more before it gives the ticket up.
- Accepted: the live ticket, and "keep this page — it is your ticket".
- The personal number is masked here. The link can be forwarded.
- The member who sent it sees its state and a link to manage invites — never the guest's QR.

## Keeping a ticket

`components/save-to-phone.tsx`, under every live ticket. Two buttons.

### Download ticket

The ticket as a picture: a 1080×1920 PNG in the app's own ink and paper, with the bar's name,
the guest's name, the night, the short code set large, and the Wox credit.

- It is drawn on the server (`lib/ticket-image.tsx`, with `ImageResponse`), so it is the same
  picture on every phone. Each kind of ticket has its address: `/pass/ticket.png`,
  `/i/{code}/ticket.png`, `/t/{token}/ticket.png`. The same rules as the page apply — the pass
  needs the session, the other two only the link.
- On a phone the button opens the share sheet with the file, where "Save Image" puts it in
  Photos and the same sheet sends it to a friend. On a computer it is a plain download. The
  picture starts being fetched as the finger lands (`onPointerDown`): a phone opens its share
  sheet only while it still counts the tap as the reason.
- Satori, which draws it, needs static fonts. They are in `assets/fonts/` (see the README
  there) and `next.config.ts` ships them with these routes.

**What its QR is.** A live pass shows a new code every thirty seconds, so a picture can never
carry it — and must never carry the key that makes it. The QR in the picture is the ticket's
own address with its short code: `/pass?c=1AD0H6`. Any camera that reads it opens the live
ticket. The door's scanner reads it too (`lib/saved-ticket.ts`) and looks the guest up by
that short code — the same lookup as typing it into Find, logged as "by hand". It is not an
admission by itself: staff see the name and decide.

### Add to home screen

Puts the live ticket itself on the home screen, where it opens like an app.

- Android and desktop Chrome: the browser's own install dialog (`beforeinstallprompt`).
- iPhone: Safari has nothing to call, so a sheet shows the taps, with the Share glyph.
- Already running from the home screen: this button is not shown.
- An invite link and a door ticket each serve **their own manifest**, so the saved icon opens
  that ticket and not the members' pass page.

Neither button is "Add to Apple/Google Wallet", on purpose. A Wallet pass carries one fixed
barcode; this ticket's defence against screenshots is that its code changes every thirty
seconds. Real Wallet passes would also need an Apple Pass Type certificate and a Google Wallet
issuer account. Google Wallet does support rotating barcodes, so that route is open if the bar
wants it.

## Watch out

- **A failed poll must not wipe a ticket that is on screen.** Keep the last good data and show
  the error under it.
- **`Qr` sets `data-value`** to what it encodes. The end-to-end tests read it. It reveals
  nothing the QR does not already say.
- **Do not format dates with `Intl` in Georgian.** See [BUG-0001](../bugs/0001-georgian-dates-render-in-english.md).
