import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { venue, type Lang } from "@/venue";
import { buildPkpass, readCertificate, readSigner, type PassSigner } from "./pkpass";
import type { Ticket } from "./types";
import { walletTicket } from "./wallet-ticket";

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

// Each path is written out in full: the build follows these to know which files must ship
// with the function (next.config.ts names the folder as well).
const PICTURES = {
  "icon.png": "assets/wallet/icon.png",
  "icon@2x.png": "assets/wallet/icon@2x.png",
  "icon@3x.png": "assets/wallet/icon@3x.png",
  "logo.png": "assets/wallet/logo.png",
  "logo@2x.png": "assets/wallet/logo@2x.png",
  "logo@3x.png": "assets/wallet/logo@3x.png",
} as const;

let ready: Promise<{ signer: PassSigner; pictures: Record<string, Buffer> }> | null = null;

/** The certificate and the pictures, read once and kept for the life of the function. */
function materials() {
  ready ??= (async () => {
    const signer = readSigner(process.env.APPLE_PASS_P12 ?? "", process.env.APPLE_PASS_P12_PASSWORD ?? "");
    if (!signer.chain.some((link) => link.subject.getField("CN")?.value === WWDR)) {
      signer.chain.push(readCertificate(await readFile(join(process.cwd(), "assets/wallet/AppleWWDRCAG4.cer"))));
    }
    const names = Object.keys(PICTURES) as (keyof typeof PICTURES)[];
    const files = await Promise.all(names.map((name) => readFile(join(process.cwd(), PICTURES[name]))));
    return { signer, pictures: Object.fromEntries(names.map((name, index) => [name, files[index]])) };
  })();
  // A certificate that will not open is tried again on the next request, not remembered.
  ready.catch(() => {
    ready = null;
  });
  return ready;
}

/** The ticket as a Wallet pass. `link` is the same address the downloaded picture's QR carries. */
export async function walletPass({ ticket, link, lang }: { ticket: Ticket; link: string; lang: Lang }): Promise<Response> {
  if (!walletReady()) return new Response(null, { status: 404 });
  let pass: Buffer;
  try {
    const { signer, pictures } = await materials();
    pass = buildPkpass({ pass: walletTicket({ ticket, link, lang }), pictures, signer });
  } catch (error) {
    console.error("wallet pass", error);
    return new Response(null, { status: 500 });
  }
  return new Response(new Uint8Array(pass), {
    headers: {
      // This type is what makes Safari offer "Add" instead of saving a file.
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="${venue.name.toLowerCase()}-${ticket.shortCode}.pkpass"`,
      // One person's ticket: never a shared cache's business.
      "Cache-Control": "private, no-store",
    },
  });
}
