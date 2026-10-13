// What a ticket, or a member's card, says in an Android phone's Google Wallet — and the signed
// link that puts it there.
//
// How Google does it. There is no file. A link, pay.google.com/gp/v/save/<token>, names the
// pass; the token is signed (RS256) with the key of a Google service account that the bar's
// Google Wallet issuer account has let in. Google reads it and offers "Add".
//
// The pass itself is stored at Google first (lib/google-api.ts) and the link carries only its
// id. A link can carry a whole pass instead, and that needs nothing stored — but Google asks
// that a token stay under 1800 characters, and Georgian is three bytes a letter: a member's
// card with a short name came to 1715, a guest's ticket to 1846. The whole pass in the link
// is kept as the way through when storing fails (`whole`), where a long link is better than none.
//
// What Google allows. A "generic" pass is a logo, the bar's name, a small line and a large
// one, four slots of label and value, and a code. Google sets every word in its own type on
// one flat colour. So the pass is the app's ink, the app's mark, and the same words as the
// pass in an iPhone's Wallet (lib/wallet-ticket.ts), in the same order.
//
// No picture is drawn for it. Google fetches a pass's pictures from a public address and
// keeps them — and a paper ticket with someone's name on it must not sit at a public address.
// The name is text here, which Google sets well: nothing lies behind it to run into.
//
// What its code is. The same as in an iPhone's Wallet, and read at the door the same way: a
// member's card carries the member's own code ("KM.<code>"), for every night; a ticket
// carries its short code, for one night. Neither admits anybody by itself.
//
// A ticket leaves with its night (validTimeInterval). A card has no end.

import { createSign } from "node:crypto";
import { fill, formatNight, formatTime, formatYear, getDict } from "@/i18n";
import { venue, type Lang } from "@/venue";
import type { MemberCard, Ticket } from "./types";
import { ticketKind } from "./wallet-ticket";

// The app's ink (app/globals.css).
const INK = "#14235e";

export const GOOGLE_SAVE_URL = "https://pay.google.com/gp/v/save/";
/** Google's own figure: a browser may cut a longer link short. */
export const SAFE_TOKEN_LENGTH = 1800;

/** The bar's issuer account at Google, and the service account that signs for it. */
export interface GoogleIssuer {
  id: string;
  email: string;
  privateKey: string;
}

export type GooglePass = Record<string, unknown>;

const text = (value: string, language: Lang) => ({ defaultValue: { language, value } });

/** Every pass of the bar's is of one class, which holds nothing: each pass says everything itself. */
export const googleClassId = (issuerId: string) => `${issuerId}.${venue.name.toLowerCase()}`;
const classOf = googleClassId;

// The four places Google's own layout gives a label and a value, by the names it knows them by.
type Slot = "row2left" | "row2right" | "row3left" | "row3right";
type Row = [slot: Slot, label: string, value: string];

function pass({
  issuerId,
  suffix,
  site,
  lang,
  kind,
  name,
  code,
  printed,
  rows,
}: {
  issuerId: string;
  /** What tells this pass from every other of the bar's. Adding the same one again replaces it. */
  suffix: string;
  /** This site's public address: Google fetches the logo from it. */
  site: string;
  lang: Lang;
  kind: string;
  name: string;
  code: string;
  /** Under the code: the part of it staff can type into Find. */
  printed: string;
  rows: Row[];
}): GooglePass {
  return {
    id: `${issuerId}.${suffix}`,
    classId: classOf(issuerId),
    state: "ACTIVE",
    hexBackgroundColor: INK,
    logo: { sourceUri: { uri: `${site}/wallet/google-logo.png` } },
    cardTitle: text(venue.name, lang),
    subheader: text(kind, lang),
    header: text(name, lang),
    barcode: { type: "QR_CODE", value: code, alternateText: printed },
    textModulesData: rows.map(([id, header, body]) => ({ id, header, body })),
  };
}

/** A member's own card: good every night, for as long as they are a member. */
export function googleCard({ card, issuerId, site, lang }: { card: MemberCard; issuerId: string; site: string; lang: Lang }): GooglePass {
  const t = getDict(lang);
  return pass({
    issuerId,
    suffix: `card-${card.code}`,
    site,
    lang,
    kind: t.ticket.member,
    name: `${card.firstName} ${card.lastName}`,
    code: card.token,
    printed: card.code,
    rows: [
      ["row2left", t.ticket.walletValid, t.ticket.walletEveryNight],
      ["row2right", t.ticket.walletSince, fill(t.ticket.walletSinceYear, { year: formatYear(card.since) })],
      ["row3left", t.common.poweredBy, venue.poweredBy.label],
    ],
  });
}

/** A ticket for one night. `doors`, when they are open that night, where the page knows it. */
export function googleTicket({
  ticket,
  issuerId,
  site,
  lang,
  doors,
}: {
  ticket: Ticket;
  issuerId: string;
  site: string;
  lang: Lang;
  doors?: { open: string; close: string };
}): GooglePass {
  const t = getDict(lang);
  const hours: Row = doors
    ? ["row2right", t.ticket.walletDoors, `${doors.open}–${doors.close}`]
    : ["row2right", t.ticket.walletUntil, fill(t.ticket.walletUntilTime, { time: formatTime(ticket.endsAt) })];
  // A night the bar has named takes the left of the second line, and the maker moves across.
  const foot: Row[] = ticket.nightTitle
    ? [
        ["row3left", t.invites.night, ticket.nightTitle],
        ["row3right", t.common.poweredBy, venue.poweredBy.label],
      ]
    : [["row3left", t.common.poweredBy, venue.poweredBy.label]];

  return {
    ...pass({
      issuerId,
      suffix: `ticket-${ticket.publicId}`,
      site,
      lang,
      kind: ticketKind(ticket, lang),
      name: `${ticket.firstName} ${ticket.lastName}`,
      code: ticket.shortCode,
      printed: ticket.shortCode,
      rows: [["row2left", t.ticket.walletDate, formatNight(ticket.night, lang)], hours, ...foot],
    }),
    // Google moves it to "expired" by itself when the night is over.
    validTimeInterval: { end: { date: ticket.endsAt } },
  };
}

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** A token signed with the service account's key, as Google reads every one of them. */
export function signGoogleToken(claims: Record<string, unknown>, privateKey: string): string {
  const signed = `${encode({ alg: "RS256", typ: "JWT" })}.${encode(claims)}`;
  return `${signed}.${createSign("RSA-SHA256").update(signed).sign(privateKey).toString("base64url")}`;
}

/**
 * The link that offers one pass to Google Wallet. `now` is in milliseconds.
 *
 * It names a pass already stored at Google. With `whole` it carries the pass itself, and the
 * class it is of, so that nothing has to be stored first — at the price of a long link.
 */
export function googleSaveLink({
  pass: object,
  issuer,
  site,
  now,
  whole = false,
}: {
  pass: GooglePass;
  issuer: GoogleIssuer;
  site: string;
  now: number;
  whole?: boolean;
}): string {
  const claims = {
    iss: issuer.email,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(now / 1000),
    // The sites allowed to offer this pass with Google's own button.
    origins: [new URL(site).host],
    payload: whole
      ? { genericClasses: [{ id: classOf(issuer.id) }], genericObjects: [object] }
      : { genericObjects: [{ id: object.id, classId: object.classId }] },
  };
  return `${GOOGLE_SAVE_URL}${signGoogleToken(claims, issuer.privateKey)}`;
}
