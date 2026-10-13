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
2. Warnings: same name as a suspended person; at capacity; marked closed tonight.
3. The person: photo, name large, status, the pass's short code, nights so far; the personal
   number in a box marked "check this against their ID"; who invited them; last visit; times
   turned away before; staff notes; a button to open their Facebook profile.
4. Two large buttons: **Deny** and **Admit**. Deny asks for a reason from six, in one more tap.

The verdict is advice. Staff may admit against a red band; the log records what they saw.

After a decision a stamp — ADMITTED or DENIED — fills the screen for a beat, then the scanner
is back. Escape closes the sheet.

### Find

For a dead phone. Type two or more characters: a name, a phone number, a personal number, or
the short code printed on a pass. Tapping a result opens the same sheet, marked "by hand".

### Ticket at the door

For someone with no pass. First name, last name, optional personal number. They are admitted
at once, and the screen shows a QR of their own ticket link (`/t/{token}`): they photograph it
and hold a ticket for coming back in.

### Log

Tonight's last 40 decisions.

## The back office — `/admin`

`(signed)/admin/`. Admins only. A light "desk" theme, set on the page root with `--ground`.

One page, six tabs. The tab is kept in the address (`#requests`), so a refresh or a shared link
lands in the same place.

The header and the row of tabs are `AdminFrame`, drawn from the tap like the door's frame. The
first tab's figures come with the page. Every other tab asks when it is first opened and is
then remembered: going back to a tab already shown never waits.

| Tab | File | What |
|---|---|---|
| Tonight | `overview.tsx` | Requests waiting; inside, passes, turned away, members; the last 14 nights as a table. |
| Requests | `requests.tsx` | The review queue, oldest first. Open the Facebook profile, add a note, approve or reject. |
| People | `people.tsx` | Rows to tap on a phone, a table on a desk. Search and filter. A person's page: status, role, inviting, quota, notes for the door, password reset, door history. |
| Nights | `nights.tsx` | "Add a night" for any date; named and changed nights by name; the next three weeks. |
| Door log | `log.tsx` | Every decision on one night: records on a phone, a table on a desk. |
| Settings | `settings.tsx` | Opening days, door hours, the cutoff, capacity, invite defaults. |

### How many requests are waiting

An admin sees the number in two places: on Office in the dock, from every screen, and on the
Requests tab. Both read one value, `me.pendingRequests` (`useRequestsWaiting` in
`components/me.tsx`). The API sends it with the account and sends 0 to everyone who is not an
admin, so it is on screen with the page and is never a second thing to wait for.

It is kept current three ways. The dock re-reads the account every 30 seconds and whenever the
app comes back into view (`signed-chrome.tsx`). Approving or rejecting takes one off at once.
And when the review queue itself reports a different total, the account is read again
(`requests.tsx`). `e2e/flow.spec.ts` holds the two places to the same number.

### Nights

Two jobs, kept apart on purpose:

- **Add a night** — pick any date from tonight on, give it a name, a note, a capacity, or close
  it. A named night can be edited or **deleted**; deleting asks once, in place, and puts the
  night back on the weekly schedule. Named nights show to guests by name on the pass, the invite calendar and the ticket.
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
