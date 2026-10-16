# Door and back office

The two screens the bar's own people use. They are opposites: the door is used standing up, in
the dark, in seconds; the back office sitting down, in daylight, for minutes.

## The door — `/door`

`(signed)/door/door-screen.tsx`, `scanner.tsx`. Staff and admins only.

### Layout

- Three counters: inside (of capacity), passes tonight, turned away. Polled every 6 seconds.
- Three tabs: **Scan**, **Find**, **Log**.
- The dock at the bottom.

The frame — who is on the door, the counters, the tabs — is `DoorFrame`. It needs nothing from
the server (a counter with no number yet shows a dash), so `DoorSkeleton` draws the very same
frame while the page is on its way, with the scanner's window waiting in it
(`ScannerStarting`). The scanner draws that same window while the camera wakes. The window is
simply there from the tap, and the picture appears in it.

### Scanning

`scanner.tsx` opens the rear camera and reads QR codes.

- Chrome on Android reads them natively (`BarcodeDetector`). Everywhere else, frames are decoded
  by `jsqr`, loaded only when needed, on a frame scaled to 640px.
- **One read per showing** (`lib/scan-presence.ts`). A code is read once. To be read again it
  must leave the frame for 1.5 seconds and come back. A pass is known by its id, not by the
  code it is showing, so a pass that rotates while held up is still the same showing. When
  reading resumes after a result, the pass just decided counts as still present — otherwise
  it is read again the moment staff tap Admit ([BUG-0002](../bugs/0002-scanner-reads-the-same-pass-twice.md)).
- Only the middle square of the picture is decoded: faster, and a second phone at the edge is
  not read by accident.
- The instant a code is read the scanner says "checking…" and the corners turn green, before
  the server answers. On a slow connection this is what stops staff waving the phone about.
- A QR that is not a pass gets a short notice under the camera, not a full-screen result.
- A ticket saved as a picture is read as well. Its QR is the ticket's address with the short
  code on the end; the scanner looks the guest up by that code and opens the usual sheet,
  marked "by hand". See tickets.md, "Download ticket".
- A member's card from an iPhone's Wallet (`KM.<code>`) is posted like any code; the API
  knows whose it is. It opens the member, marked "by hand": with tonight's pass if they
  hold one, otherwise as "Member", in the go tone — the card is for every night, and
  Admit issues tonight's pass. See tickets.md, "A member's card".
- The camera keeps running while a result is up but stops reading, so it is ready at once.
- The screen is kept awake; the camera is started again if the phone took it away; a torch
  button appears where the device has one.
- A blocked or missing camera says so, and offers **Find** as a button in the same place. The
  line "point the camera at the pass" is not shown then.
- **The camera needs https.** On plain http (other than localhost) browsers refuse.

A read token is posted to `POST /api/door/scan`. The phone vibrates: once for go, twice otherwise.

### The result sheet

A full-screen sheet over everything, including the dock.

1. A band in the verdict's tone — go, wait or stop — with the verdict in words and a hint.
   The hint claims only what is true of how the person was reached: "live code" for a code
   read live off a phone; "check the face or an ID" for a pass reached by hand; "check the
   face against the photo" for a member's card (or "no photo, ask for an ID").
   **"Already in" comes with its evidence:** when, whose tap, and "by hand" where the
   person was not scanned.
2. Warnings: same name as a suspended person; at capacity; marked closed tonight.
3. The person: photo, name large, status, the pass's short code, nights so far (for an
   account only — nobody counts the nights of a guest with none, and the card does not guess
   "first time here"); that they are in, under any verdict but "already in"; the personal
   number in a box marked "check this against their ID"; who invited them (a guest), or whose
   permanent invite made them a member ("Invited by"); last visit; times
   turned away before; staff notes; a button to open their profile, named for the network it is
   on ("Open Instagram"; for a network the app has no name for, the host itself).
4. Two large buttons: **Deny** and **Admit**. Deny asks for a reason from six, in one more tap.
5. When tonight's pass is in, a third answer under them: **"Mistake, they are not in"**. It
   takes the admission back (`POST /door/undo`) and the sheet is drawn again from the
   answer — the same person, not let in, usually now a go. Before this the only way out of a
   wrong "already in" was Deny, which wrote a refusal against a guest and changed nothing
   ([BUG-0008](../bugs/0008-the-door-says-already-in-with-no-evidence-and-no-way-back.md)).
   The sheet's own way out is "Close", not "Cancel": in Georgian the two words were one.

The verdict is advice. Staff may admit against a red band; the log records what they saw. The
buttons carry the advice too: on a go the Admit button is filled and Deny is an outline, on a
stop it is the other way round, and on a wait both are filled. Neither ever moves or goes away.

After a decision a stamp — ADMITTED or DENIED — fills the screen for a beat, then the scanner
is back. Escape closes the sheet.

### The receipt

The stamp is gone in a second, and Admit is one tap. So the last decision made on this phone
stays under the scanner, in place of "point the camera at a pass", until the next one: the
name, what was decided in its colour, the time. Tapping it opens that person again. Beside a
first admission is **"Mistake"**, which takes it back in one tap. Not beside a re-entry —
that person was already inside — and not beside a refusal, which changed nothing. It is
this phone's own receipt, not the door's latest row: what another phone decided is in the Log.

### Find

For a dead phone. Type two or more characters: a name, a phone number, a personal number, or
the short code printed on a pass. Tapping a result opens the same sheet, marked "by hand".

### Ticket at the door

For someone with no pass. First name, last name, optional personal number. They are admitted
at once, and the screen shows a QR of their own ticket link (`/t/{token}`): they photograph it
and hold a ticket for coming back in.

### Log

Tonight's last 40 decisions. In Georgian the tab is "სია" (the list). A row opens that person
again, in the same sheet, marked "by hand" — to see who it was, or to decide again. Nothing in
the list is ever changed: a second answer is a second record, and an admission taken back is a
third kind of row ("Taken back", quiet), written after the admission it answers. The chip
is `components/decision-chip.tsx`, shared with the back office's log and a person's history.

## The back office — `/admin`

`(signed)/admin/`. Admins only. A light "desk" theme, set on the page root with `--ground`.

One page, six tabs. The tab is kept in the address (`#requests`), so a refresh or a shared link
lands in the same place.

The header and the row of tabs are `AdminFrame`, drawn from the tap like the door's frame. The
first tab's figures come with the page. Every other tab asks when it is first opened and is
then remembered: going back to a tab already shown never waits.

| Tab | File | What |
|---|---|---|
| Tonight | `overview.tsx` | Requests waiting; inside, passes, turned away, members; the last 14 nights as a table. A night in the table opens the door's list for that night. |
| Requests | `requests.tsx` | The review queue, oldest first. Open the guest's profile — the button names the network (`lib/profile-link.ts`) — then approve with one tap or reject with two: the first opens the note to the guest and a way back. |
| People | `people.tsx` | Rows to tap on a phone, a table on a desk. Search, and filters in one row that scrolls. A row opens the person: see "A person". |
| Nights | `nights.tsx` | "Add a night" for any date; named and changed nights by name; the next three weeks, each night a row to tap. |
| Door log | `log.tsx` | Every decision on one night: records on a phone, a table on a desk. Arrows step a night back and on; the date field takes any other night. In Georgian the tab is "კარის სია" (the door's list). |
| Settings | `settings.tsx` | Opening days, door hours, the cutoff, capacity, invite defaults. |

### How many requests are waiting

An admin sees the number in two places: on Office in the dock, from every screen, and on the
Requests tab. Both read one value, `me.pendingRequests` (`useRequestsWaiting` in
`components/me.tsx`). The API sends it with the account and sends 0 to everyone who is not an
admin, so it is on screen with the page and is never a second thing to wait for.

It is kept current three ways. The dock re-reads the account every 30 seconds, on every move
to another screen, and whenever the app comes back into view (`signed-chrome.tsx`) — for
everyone, see "A person". Approving or rejecting takes one off at once.
And when the review queue itself reports a different total, the account is read again
(`requests.tsx`). `e2e/flow.spec.ts` holds the two places to the same number.

### A person

`PersonDetail` in `people.tsx`. What the bar decides about someone is one card of controls,
and **each is saved by the tap that changes it** — there is no Save button for them. "Saved"
appears at the top of the page, in the same place every time.

- **Role** — three buttons side by side: Member, Door, Admin. The line under them names what
  that role finds in the dock, in the dock's own words.
- **Can invite guests** — a switch, off for everyone until it is switched on here.
  While it is on, the number of guests per night is beside it, with a minus and a plus, and
  under it a second switch, **Can invite permanent members**: off until it is switched on
  here, for the few the bar trusts to make members. Everyone with an account has the first
  row — members, people waiting for the bar, guests who made an account — since an admin may
  let any of them invite tonight's guests. Only an approved member has the permanent switch.
  Someone the bar turned away has none.
  An admin has none of them: one line says an admin can always invite — tonight's guests
  with no limit, and permanent members.
- **Invited by** — under the name, for a member made by someone's permanent invite.
- **Status** — a list. Suspending is asked for twice, in place: it voids the person's passes
  and invites and cannot be taken back.
- **Notes for the door** are typed, so they alone have a Save button, which appears when the
  text has changed.

**The person's own phone follows.** Every signed-in app asks for its account again every 30
seconds, on every move to another screen and on coming back into view. A new role redraws
the dock. A new role or status also has the open page made again on the server, which sends
someone who has just lost the door or the office to their pass. Until 2026-10-13 only an
admin's app asked again, and anyone else kept the dock they had signed in with
([BUG-0007](../bugs/0007-a-new-role-does-not-reach-an-open-app.md)).

### Nights

Two jobs, kept apart on purpose:

- **Add a night** — pick any date from tonight on, give it a name, a note, a capacity, or close
  it. A named night can be edited or **deleted**; deleting asks once, in place, and puts the
  night back on the weekly schedule. Named nights show to guests by name on the pass, the invite form (tonight's) and the ticket.
- **The next three weeks** — the plain schedule, where any single night can be edited.

A night that has been named or changed is listed at the top, even when it is months ahead.
"Back to the schedule" removes the change.

### A password reset

There is no SMS or email. The admin presses Reset password and reads the guest the one-time
password that appears. It is shown once.

## Watch out

- **Do not make the result sheet smaller or dismissible by a stray tap.** A decision at the
  door must be deliberate.
- **Nothing on the door screen may depend on hover.** It is used on a phone.
- **The admin tabs poll gently** (10–60 s) and stop polling while a form is open, so typing is
  never overwritten.
- **Counters come from the API.** Do not count entries in the browser.
