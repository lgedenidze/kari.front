import "server-only";
import { venue, type Lang } from "@/venue";
import { storeGooglePass, type Send } from "./google-api";
import { googleCard, googleSaveLink, googleTicket, type GoogleIssuer, type GooglePass } from "./google-pass";
import type { MemberCard, Ticket } from "./types";

// "Add to Google Wallet". A pass is stored at Google (lib/google-api.ts) and the phone is sent
// on to Google with a signed link that names it (lib/google-pass.ts). Both are done with the
// key of a Google service account, which the bar's Google Wallet issuer account has let in.
//
// That key is a secret and is never committed. It is given to the server as two environment
// variables:
//   GOOGLE_WALLET_ISSUER_ID  the issuer account's number, from the Google Pay & Wallet console
//   GOOGLE_WALLET_KEY        the service account's key file (JSON) from Google Cloud, base64
// With either missing there is no Google Wallet button anywhere and these routes answer 404:
// the feature is simply not there. scripts/google-wallet.sh installs them.
//
// Until Google has given the issuer account publishing access, a pass can be added only by
// the accounts named in that console (its admins, developers and test accounts), and says
// "TEST ONLY". That is Google's rule, not a fault here.

/** Whether this server can offer a pass to Google Wallet. Cheap: pages ask it on every request. */
export function googleWalletReady(): boolean {
  return Boolean(process.env.GOOGLE_WALLET_ISSUER_ID && process.env.GOOGLE_WALLET_KEY);
}

let issuer: GoogleIssuer | null = null;

/** The key file, read once and kept for the life of the function. */
function readIssuer(): GoogleIssuer {
  if (issuer) return issuer;
  const key = JSON.parse(Buffer.from(process.env.GOOGLE_WALLET_KEY ?? "", "base64").toString("utf8")) as { client_email?: string; private_key?: string };
  if (!key.client_email || !key.private_key) throw new Error("GOOGLE_WALLET_KEY is not a service account's key file");
  issuer = { id: process.env.GOOGLE_WALLET_ISSUER_ID ?? "", email: key.client_email, privateKey: key.private_key };
  return issuer;
}

// A tap must not hang on Google: each request gets a few seconds and no more.
const send: Send = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(6000), cache: "no-store" });

/** Stores the pass at Google and sends the phone on to Google to add it. */
async function offer(build: (issuerId: string, site: string) => GooglePass): Promise<Response> {
  if (!googleWalletReady()) return new Response(null, { status: 404 });
  let link: string;
  try {
    const signer = readIssuer();
    // The site's public address, not the one this request came to: Google fetches the logo
    // from it, and a preview deployment's address is behind a sign-in.
    const site = venue.url;
    const pass = build(signer.id, site);
    const now = Date.now();
    let whole = false;
    try {
      await storeGooglePass({ pass, issuer: signer, now, send });
    } catch (error) {
      // Not stored — Google is slow, or would not take it. The link can carry the pass itself;
      // it is long that way, and a long link is better than none.
      console.error("google wallet: the pass was not stored; sending it whole in the link", error);
      whole = true;
    }
    link = googleSaveLink({ pass, issuer: signer, site, now, whole });
  } catch (error) {
    console.error("google wallet pass", error);
    return new Response(null, { status: 500 });
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: link,
      // One person's pass: never a shared cache's business.
      "Cache-Control": "private, no-store",
    },
  });
}

/** A member's own card, offered to Google Wallet. */
export function googleCardOffer({ card, lang }: { card: MemberCard; lang: Lang }): Promise<Response> {
  return offer((issuerId, site) => googleCard({ card, issuerId, site, lang }));
}

/** A ticket for one night, offered to Google Wallet. `doors`, when they are open that night. */
export function googleTicketOffer({ ticket, lang, doors }: { ticket: Ticket; lang: Lang; doors?: { open: string; close: string } }): Promise<Response> {
  return offer((issuerId, site) => googleTicket({ ticket, issuerId, site, lang, doors }));
}
