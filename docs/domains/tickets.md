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
  review, pass), and the profile that was sent — a link, so they can see it opens the
  right profile — with a way to change it. A mistyped link is the usual reason a request sits
  unanswered. The page polls and changes by itself when the bar answers;
- `rejected` → the bar's note, and a form to fix the profile link and ask again;
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
  Tonight says "Today". Every night is the same small block — the weekday over the day of the
  month — so the dates line up along the row. A named night is that block as the stub of a
  ticket, with a dashed tear line and its name on the ticket beside it: the headline cut, two
  lines at most, then an ellipsis. A night with no invites left is a dashed, empty outline.
  It can still be tapped: the line under the row then says there is nothing left to send,
  in red, and the button is off. Under the row: the chosen night in full — date, name, note,
  invites left. The row scrolls sideways and fades at its far edge. The API sends the nights
  (`InvitesOverview.nights`); the row does not generate dates.
- **The personal number and the phone** are folded behind one line, "+ Personal number or
  phone". They unfold by themselves when the API finds a mistake in one.
- **What comes back is a sheet** over the whole screen: the guest's name, the night, the link
  as a QR to scan off the member's phone, and one large Share button. The invite is not done
  until the guest has it, so that is all there is until the member closes the sheet. Behind
  it the form is empty again. Sharing sends a line of words with the link — "Invite: KARI,
  Fri 16 Oct" — so the guest's chat shows what it is.
- **Sent** — under the form: each invite with its state, Share, and Cancel (asked for twice).
- **For you** — above the form, only when there is an invite. Accept goes straight to the
  pass, where the ticket is. Decline is asked for twice: an invite cannot be accepted again.
- **Not allowed to invite** — one line in place of the form. Inviting is a permission every
  member has until the bar switches it off for them (`me.canInvite`, from the API); someone
  who is not a member yet is told it is for members. There is nothing to count towards. An
  admin's switch reaches the open screen within seconds: the invites are asked for again
  every 8.

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

`components/save-to-phone.tsx`, under every live ticket. Two buttons, and on an iPhone a third,
first: Add to Apple Wallet.

### Add to Apple Wallet

On an iPhone, where the bar has its certificate from Apple, the badge is the first thing
under the ticket and the only filled one; the other two buttons are outlines there. It is a
plain link to the ticket as a `.pkpass`: the phone answers that file with its own "Add"
sheet. Each kind of ticket has its address, beside its picture: `/pass/wallet.pkpass`,
`/i/{code}/wallet.pkpass`, `/t/{token}/wallet.pkpass`, under the same rules as the page.

- **A member's card.** The owner, the night after the pass shipped: "active users qr should
  be active at wallet always, not invited guys". A ticket is for one night, and a guest adds
  it for that night. A member adds **their card**, once: `/pass/wallet.pkpass` answers a
  member in good standing with the card whether or not they hold a pass tonight
  (`GET /api/pass/card`; anyone else who holds a ticket tonight still gets that ticket).
  It is the same pass with no night on it (`walletCard` in `lib/wallet-ticket.ts`): where
  the date was, "valid: every night"; on the stub, "member since" the year; no
  `expirationDate`, so it never goes grey. Its code is the member's own, `KM.<code>` —
  ten characters, still the smallest QR — with the seven-character code printed under it,
  which staff can type into Find. Its serial number is the card's, so adding it again
  replaces the one in Wallet. The door reads it as the member, with their photo, marked
  "by hand"; see door-and-admin.md, "Scanning". Suspend the member and the card is worth
  nothing that minute, with no need to reach the phone. The live pass in the app is
  unchanged: it is still the strong proof, and still claimed for a night.
- **Where the badge is, for a member.** Under tonight's ticket as before, and also — by
  itself (`WalletLink`) — under the unclaimed and the closed-night ticket: the card is
  theirs on a night with nothing to save. This phone remembers the card by the member,
  not by a ticket's short code, so the badge is not offered afresh every night.

- **What Wallet allows.** It draws every word of a pass itself, in its own typeface, and
  puts each kind of field where it likes. It draws the code too: black on a white tile, at
  the foot of the pass, at its own size, with whatever room is left empty above it. None of
  that can be styled. The app's look reaches the pass through three things only: the
  colours, the logo picture and the band picture (the "strip", 375 by 98 points).
- **What the pass is** (`lib/wallet-ticket.ts`): the app's own screen. Ink for a ground; the
  wordmark and the date at the top; then the band — a paper ticket with notches, the
  holder's name in the headline cut on two lines, the kind of ticket over it, and the
  maker's stamp; then the stub — when the doors are open (or, for a ticket issued at the
  door, the hour it runs out) and "powered by wox.ge"; a named night's name has a row to
  itself above the stub. On its back: the name in words, the link to the live ticket, and
  the Wox link. It turns grey when its night ends (`expirationDate`) and Wallet will not
  share it on (`sharingProhibited`).
- **The band is drawn for each pass** (`lib/wallet-strip.tsx`, with the fonts of the
  downloaded picture). The name is not left to Wallet's own name field: that is set in
  Wallet's type and runs across whatever is behind it — a first version had the name over
  the stamp, and the owner called it what it was. Here the name is sized by its longer half
  so it always ends before the stamp. Because it is a picture, the name is also in the
  pass's `description`, for VoiceOver, and on the back.
- **What its code is.** The ticket's short code and nothing else — not the ticket's address,
  as in the picture below. Six characters make a code of 21 by 21 large squares; the
  address made a dense one, and the owner found it ugly. The door reads either form
  (`lib/saved-ticket.ts`) as the same lookup, logged "by hand", and opens only the pass
  that carries that very code.
- **The code in Wallet never changes, and that is handled at the door.** A live ticket
  shows a new code every thirty seconds; Wallet holds one code and has no way to turn it
  over (a pass can be re-sent by push, in minutes, not seconds). So a Wallet code admits
  nobody by itself: the scanner opens the person — photo, name — marked "by hand", staff
  decide, and a second showing of the same code says "already in". A ticket the bar
  cancels is caught by that lookup, not by Wallet.
- **"Added to Wallet".** A page cannot ask Wallet what is in it; only an app can. So the
  phone remembers, for each ticket or card, that its badge was tapped (`localStorage`), and shows
  "Added to Wallet" with an "Add again" link in the badge's place — the tap may have been
  called off, and a pass already in Wallet is replaced by adding it again.
- **How the file is made** (`lib/pkpass.ts`, no knowledge of tickets, tested with a
  certificate made on the spot): a zip of `pass.json`, the icon and logo (`assets/wallet/`,
  drawn by `e2e/wallet-art.mjs`, which also draws the stamp), the band, a manifest of
  SHA-1 sums, and a detached PKCS #7 signature of that manifest. The Pass Type ID and the
  Team ID are read off the certificate, so they cannot disagree with it.
- **The certificate** is a secret from the bar's Apple Developer account. It reaches the
  server as `APPLE_PASS_P12` (the .p12, base64) and `APPLE_PASS_P12_PASSWORD`, in the Vercel
  project's settings. `scripts/wallet-certificate.sh` makes the request file for Apple and
  installs Apple's answer. **With no certificate there is no badge anywhere and the routes
  answer 404** (`walletReady()`); `e2e/ticket-image.spec.ts` holds the badge to exactly the
  cases where the file exists, and to iPhones.
- **The badge** (`components/apple-wallet-badge.tsx`) is the one thing not drawn in the
  app's own vocabulary: Apple asks that it look the same everywhere. It is a drawing of
  Apple's badge. Apple's own file comes only with its Wallet marketing agreement; when the
  account has accepted it, put Apple's file in that component.
- **Installed on 2026-10-13.** Pass Type ID `pass.ge.wox.kari`, in the owner's Apple
  Developer team (Vellin Inc., `C9A26VQ37D`). **The certificate expires on 2027-11-12:**
  make a new one before then (`scripts/wallet-certificate.sh`, both steps), or the badge
  starts handing out passes an iPhone refuses.
- **What has been checked, and what has not.** A pass fetched from the live site verifies
  with `openssl smime -verify` all the way to Apple's root certificate, and its manifest
  matches its files. The owner looked at the first design on his iPhone the same day and
  asked for this one. **A pass already in Wallet does not change by itself:** to see a new
  design, delete the pass and add it again. A one-night pass a member added before the
  card existed still reads at the door that night, by its short code, and goes grey after.
  The card has not been seen in a real Wallet by anyone but the owner.

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

There is no "Add to Google Wallet". It needs a Google Wallet issuer account; it does support
rotating barcodes, so that route is open if the bar wants it.

## Watch out

- **A failed poll must not wipe a ticket that is on screen.** Keep the last good data and show
  the error under it.
- **`Qr` sets `data-value`** to what it encodes. The end-to-end tests read it. It reveals
  nothing the QR does not already say.
- **Do not format dates with `Intl` in Georgian.** See [BUG-0001](../bugs/0001-georgian-dates-render-in-english.md).
