import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDict } from "@/i18n";
import { venue, type Lang } from "@/venue";
import { buildPkpass, readCertificate, readSigner, type PassSigner } from "./pkpass";
import type { MemberCard, Ticket } from "./types";
import { walletStrip } from "./wallet-strip";
import { ticketKind, walletCard, walletTicket } from "./wallet-ticket";

// "Add to Apple Wallet". A ticket is handed over as a .pkpass, signed with the bar's Pass
// Type ID certificate from Apple.
//
// That certificate is a secret and is never committed. It is given to the server as two
// environment variables:
//   APPLE_PASS_P12           the .p12 file (certificate and private key), base64
//   APPLE_PASS_P12_PASSWORD  its password
// The Pass Type ID and the Team ID are read off the certificate. With no certificate there is
// no Wallet button anywhere and these routes answer 404: the feature is simply not there.

/** Whether this server can make a Wallet pass. Cheap: pages ask it on every request. */
export function walletReady(): boolean {
  return Boolean(process.env.APPLE_PASS_P12);
}

// Apple's intermediate certificate, which every Pass Type ID certificate is issued under. It
// is public (apple.com/certificateauthority). Wallet needs it inside the signature; it is
// added here when the .p12 did not bring it along.
const WWDR = "Apple Worldwide Developer Relations Certification Authority";

// Each file is read by a path written out in full, one call each: the build follows these
// to know which files must ship with the function, and a path put together at run time
// makes it ship the whole project instead (next.config.ts names the folder as well).
const readPictures = async (): Promise<Record<string, Buffer>> => ({
  "icon.png": await readFile(join(process.cwd(), "assets/wallet/icon.png")),
  "icon@2x.png": await readFile(join(process.cwd(), "assets/wallet/icon@2x.png")),
  "icon@3x.png": await readFile(join(process.cwd(), "assets/wallet/icon@3x.png")),
  "logo.png": await readFile(join(process.cwd(), "assets/wallet/logo.png")),
  "logo@2x.png": await readFile(join(process.cwd(), "assets/wallet/logo@2x.png")),
  "logo@3x.png": await readFile(join(process.cwd(), "assets/wallet/logo@3x.png")),
});

let ready: Promise<{ signer: PassSigner; pictures: Record<string, Buffer> }> | null = null;

/** The certificate and the pictures, read once and kept for the life of the function. */
function materials() {
  ready ??= (async () => {
    const signer = readSigner(process.env.APPLE_PASS_P12 ?? "", process.env.APPLE_PASS_P12_PASSWORD ?? "");
    if (!signer.chain.some((link) => link.subject.getField("CN")?.value === WWDR)) {
      signer.chain.push(readCertificate(await readFile(join(process.cwd(), "assets/wallet/AppleWWDRCAG4.cer"))));
    }
    return { signer, pictures: await readPictures() };
  })();
  // A certificate that will not open is tried again on the next request, not remembered.
  ready.catch(() => {
    ready = null;
  });
  return ready;
}

/** The ticket as a Wallet pass. `live` is the live ticket's own address; `doors`, when they are open that night. */
export function walletPass({
  ticket,
  live,
  lang,
  doors,
}: {
  ticket: Ticket;
  live: string;
  lang: Lang;
  doors?: { open: string; close: string };
}): Promise<Response> {
  return answer({
    fields: walletTicket({ ticket, live, lang, doors }),
    band: { kind: ticketKind(ticket, lang), firstName: ticket.firstName, lastName: ticket.lastName },
    fileName: `${venue.name.toLowerCase()}-${ticket.shortCode}`,
  });
}

/** A member's own card as a Wallet pass: the same paper ticket, with no night on it. */
export function walletCardPass({ card, live, lang }: { card: MemberCard; live: string; lang: Lang }): Promise<Response> {
  return answer({
    fields: walletCard({ card, live, lang }),
    band: { kind: getDict(lang).ticket.member, firstName: card.firstName, lastName: card.lastName },
    fileName: `${venue.name.toLowerCase()}-member`,
  });
}

/** Draws the band, signs the pass, and hands it over as the file an iPhone opens in Wallet. */
async function answer({
  fields,
  band,
  fileName,
}: {
  fields: Record<string, unknown>;
  band: { kind: string; firstName: string; lastName: string };
  fileName: string;
}): Promise<Response> {
  if (!walletReady()) return new Response(null, { status: 404 });
  let pass: Buffer;
  try {
    const [{ signer, pictures }, strip] = await Promise.all([materials(), walletStrip(band)]);
    pass = buildPkpass({ pass: fields, pictures: { ...pictures, ...strip }, signer });
  } catch (error) {
    console.error("wallet pass", error);
    return new Response(null, { status: 500 });
  }
  return new Response(new Uint8Array(pass), {
    headers: {
      // This type is what makes Safari offer "Add" instead of saving a file.
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="${fileName}.pkpass"`,
      // One person's ticket: never a shared cache's business.
      "Cache-Control": "private, no-store",
    },
  });
}
