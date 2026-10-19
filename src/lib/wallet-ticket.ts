// What a ticket says once it is in an iPhone's Wallet: the fields of pass.json.
//
// What Wallet allows. It draws every word itself, in its own typeface, and decides where
// each kind of field goes. It draws the code too: black on a white tile, at the foot of the
// pass, at a size of its own choosing. None of that can be styled. The app's look comes from
// three things only: the colours, the logo picture, and the band picture (the "strip").
//
// So the pass is the app's own screen, read from the top:
//   - ink for a ground, as everywhere in the app; on it the wordmark and the date;
//   - the band (lib/wallet-strip.tsx): a paper ticket with the holder's name in the headline
//     cut and the maker's stamp — drawn by us, because Wallet's own name field is set in
//     Wallet's type and runs across whatever is behind it;
//   - the stub: when the doors are open, and "powered by wox.ge", as on every stub in the
//     app — and above them, when the bar has named the night, that name on a row of its own;
//   - the code, on its white tile, which reads cleanly on ink.
//
// What its code is. A live pass changes its code every thirty seconds; Wallet holds one code
// and never changes it. So this is not a pass code: it is the ticket's short code, the one
// printed on every ticket and typed into Find. The door's scanner reads it as that lookup
// (lib/saved-ticket.ts) and marks the entry "by hand": staff see the name and the photo and
// decide, and a second showing says "already in". The short code alone, and not the ticket's
// address as in the downloaded picture, because six characters make a code of large, clean
// squares and an address makes a dense one. The address is on the back of the pass.
//
// The pass goes grey by itself when its night is over (expirationDate), and it cannot be
// passed on from Wallet's own share sheet (sharingProhibited): it has a name on it.
//
// A member's card (walletCard, below) is the same pass with no night on it. A ticket is for
// one night and a guest adds it for that night; a member adds their card once and it is good
// every night, because what it carries is not a ticket's code but the member's own
// ("KM.<code>"). The door reads that as the member, with their photo — and as nothing at
// all the minute the bar suspends them. It never goes grey: there is no date for it to pass.

import { fill, formatNight, formatTime, formatYear, getDict } from "@/i18n";
import { venue, type Lang } from "@/venue";
import type { MemberCard, Ticket } from "./types";

// The app's own colours (app/globals.css). The ink is also the ground of the band picture,
// to the digit — see lib/wallet-strip.tsx.
const INK = "rgb(20, 35, 94)";
const PAPER_LIGHT = "rgb(251, 236, 238)";
const INK_SOFT = "rgb(169, 182, 230)";

/** The line over the name: what kind of ticket this is. Shared with the band picture. */
export function ticketKind(ticket: Ticket, lang: Lang): string {
  const t = getDict(lang);
  // Not whose guest: who invited them stays in the bar's records, not on the ticket (owner, 2026-10-20).
  if (ticket.kind === "door") return t.ticket.doorTicket;
  return ticket.kind === "guest" ? t.status.guest : t.ticket.member;
}

export function walletTicket({
  ticket,
  live,
  lang,
  doors,
}: {
  ticket: Ticket;
  /** The live ticket's own address, for the back of the pass. */
  live: string;
  lang: Lang;
  /** When the doors are open that night, where the page knows it. */
  doors?: { open: string; close: string };
}): Record<string, unknown> {
  const t = getDict(lang);
  const kind = ticketKind(ticket, lang);
  const name = `${ticket.firstName} ${ticket.lastName}`;

  // The stub's two ends, as on the app's ticket: what the holder needs on the near side, who
  // made it on the far side.
  const stub = [
    doors
      ? { key: "doors", label: t.ticket.walletDoors, value: `${doors.open}–${doors.close}` }
      : { key: "until", label: t.ticket.walletUntil, value: fill(t.ticket.walletUntilTime, { time: formatTime(ticket.endsAt) }) },
    { key: "maker", label: t.common.poweredBy, value: venue.poweredBy.label, textAlignment: "PKTextAlignmentRight" },
  ];

  return {
    serialNumber: ticket.publicId,
    organizationName: venue.name,
    // Read out by VoiceOver for the pass as a whole; the name on the band is a picture.
    description: `${venue.name}, ${kind}, ${name}`,
    backgroundColor: INK,
    foregroundColor: PAPER_LIGHT,
    labelColor: INK_SOFT,
    expirationDate: ticket.endsAt,
    sharingProhibited: true,
    barcodes: [{ format: "PKBarcodeFormatQR", message: ticket.shortCode, messageEncoding: "iso-8859-1", altText: ticket.shortCode }],
    eventTicket: {
      headerFields: [{ key: "date", label: t.ticket.walletDate, value: formatNight(ticket.night, lang) }],
      // A night the bar has named gets the first row under the band to itself, so a long
      // name is never squeezed; the stub then moves down a row.
      secondaryFields: ticket.nightTitle ? [{ key: "title", label: t.invites.night, value: ticket.nightTitle }] : stub,
      auxiliaryFields: ticket.nightTitle ? stub : [],
      backFields: [
        { key: "name", label: kind, value: name },
        { key: "door", label: t.ticket.showAtDoor, value: t.ticket.walletDoor },
        { key: "live", label: t.ticket.walletLive, value: live },
        { key: "credit", label: t.common.poweredBy, value: venue.poweredBy.href },
      ],
    },
  };
}

/** A member's own card: good every night, for as long as they are a member. */
export function walletCard({
  card,
  live,
  lang,
}: {
  card: MemberCard;
  /** Where the member's live pass is, for the back of the card. */
  live: string;
  lang: Lang;
}): Record<string, unknown> {
  const t = getDict(lang);
  const name = `${card.firstName} ${card.lastName}`;

  return {
    // One card per member, whatever is drawn on it: adding it again replaces the one in Wallet.
    serialNumber: `card-${card.code}`,
    organizationName: venue.name,
    description: `${venue.name}, ${t.ticket.walletCard}, ${name}`,
    backgroundColor: INK,
    foregroundColor: PAPER_LIGHT,
    labelColor: INK_SOFT,
    sharingProhibited: true,
    // The code under the picture is the part staff can type into Find.
    barcodes: [{ format: "PKBarcodeFormatQR", message: card.token, messageEncoding: "iso-8859-1", altText: card.code }],
    eventTicket: {
      // Where a ticket has its date.
      headerFields: [{ key: "valid", label: t.ticket.walletValid, value: t.ticket.walletEveryNight }],
      secondaryFields: [
        { key: "since", label: t.ticket.walletSince, value: fill(t.ticket.walletSinceYear, { year: formatYear(card.since) }) },
        { key: "maker", label: t.common.poweredBy, value: venue.poweredBy.label, textAlignment: "PKTextAlignmentRight" },
      ],
      auxiliaryFields: [],
      backFields: [
        { key: "name", label: t.ticket.walletCard, value: name },
        { key: "door", label: t.ticket.showAtDoor, value: t.ticket.walletCardDoor },
        { key: "live", label: t.ticket.walletLive, value: live },
        { key: "credit", label: t.common.poweredBy, value: venue.poweredBy.href },
      ],
    },
  };
}
