// What a ticket says once it is in an iPhone's Wallet: the fields of pass.json.
//
// It is the same ticket as the picture (lib/ticket-image.tsx), with the same limits. Wallet
// holds one fixed code, and a live pass changes its code every thirty seconds, so the code
// here is the ticket's own address with the short code on the end — exactly the picture's.
// A camera that reads it opens the live ticket. The door's scanner reads it too, looks the
// guest up by the short code and marks the entry "by hand", so staff check the name.
//
// The pass goes grey by itself when its night is over (expirationDate), and it cannot be
// passed on from Wallet's own share sheet (sharingProhibited): it has a name on it.

import { fill, formatNight, formatTime, getDict } from "@/i18n";
import { venue, type Lang } from "@/venue";
import type { Ticket } from "./types";

// The app's own colours (app/globals.css): cloakroom-ticket paper, with stamp ink on it.
const PAPER = "rgb(244, 212, 215)";
const INK_DEEP = "rgb(12, 23, 64)";
const PAPER_SOFT = "rgb(77, 90, 143)";

export function walletTicket({ ticket, link, lang }: { ticket: Ticket; link: string; lang: Lang }): Record<string, unknown> {
  const t = getDict(lang);
  const kind =
    ticket.kind === "guest" && ticket.inviterName
      ? fill(t.ticket.guestOf, { name: ticket.inviterName })
      : ticket.kind === "door"
        ? t.ticket.doorTicket
        : ticket.kind === "guest"
          ? t.status.guest
          : t.ticket.member;
  // The live ticket's address, without the short code the QR carries for the door.
  const live = link.split("?")[0];

  return {
    serialNumber: ticket.publicId,
    organizationName: venue.name,
    description: `${venue.name}, ${kind}`,
    logoText: venue.name,
    backgroundColor: PAPER,
    foregroundColor: INK_DEEP,
    labelColor: PAPER_SOFT,
    expirationDate: ticket.endsAt,
    sharingProhibited: true,
    barcodes: [{ format: "PKBarcodeFormatQR", message: link, messageEncoding: "iso-8859-1", altText: ticket.shortCode }],
    eventTicket: {
      headerFields: [{ key: "night", label: t.invites.night, value: formatNight(ticket.night, lang) }],
      primaryFields: [{ key: "name", label: kind, value: `${ticket.firstName} ${ticket.lastName}` }],
      secondaryFields: [
        // A night the bar has named is the first thing a guest looks for.
        ...(ticket.nightTitle ? [{ key: "title", label: t.invites.night, value: ticket.nightTitle }] : []),
        { key: "code", label: t.ticket.code, value: ticket.shortCode },
        { key: "until", label: t.ticket.walletUntil, value: fill(t.ticket.walletUntilTime, { time: formatTime(ticket.endsAt) }), textAlignment: "PKTextAlignmentRight" },
      ],
      backFields: [
        { key: "door", label: t.ticket.showAtDoor, value: t.ticket.walletDoor },
        { key: "live", label: t.ticket.walletLive, value: live },
        { key: "maker", label: t.common.poweredBy, value: venue.poweredBy.href },
      ],
    },
  };
}
