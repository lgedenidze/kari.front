// A ticket saved as a picture, or put in an iPhone's Wallet, carries a QR of its own address
// with the pass's short code on the end: /pass?c=1AD0H6, /i/…?c=…, /t/…?c=…
// (lib/ticket-image.tsx draws the picture; lib/wallet-ticket.ts fills the Wallet pass).
//
// It is not a pass code — those change every thirty seconds and cannot be saved. But the door
// can still read it: the short code is the one printed on the ticket, which staff can already
// type into Find. Reading it off the picture is the same lookup, without the typing.

/** The address a saved ticket points back to, with its short code for the door to read. */
export function savedTicketLink(origin: string, path: string, shortCode: string): string {
  return `${origin}${path}?c=${encodeURIComponent(shortCode)}`;
}

const TICKET_PATH = /^\/(pass|i\/[^/]+|t\/[^/]+)\/?$/;
const SHORT_CODE = /^[0-9A-Z]{4,12}$/;

/** The short code inside a saved ticket's QR, or null when the text is anything else. */
export function savedTicketCode(text: string): string | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!TICKET_PATH.test(url.pathname)) return null;
  const code = (url.searchParams.get("c") ?? "").toUpperCase();
  return SHORT_CODE.test(code) ? code : null;
}
