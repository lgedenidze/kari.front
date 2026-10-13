// The file an iPhone's Wallet opens: a .pkpass. It is a zip of pass.json, a few pictures, a
// manifest that lists the SHA-1 of every file, and a signature over that manifest made with
// the bar's Pass Type ID certificate from Apple. Wallet refuses a pass whose signature does
// not lead back to Apple, so none of this can be seen on a phone without that certificate.
//
// Nothing here knows about tickets or reads the environment (lib/wallet-pass.ts does), so it
// can be tested with a certificate made up on the spot.

import { createHash } from "node:crypto";
import forge from "node-forge";

/** What signs a pass: the Pass Type ID certificate, its private key, and the certificates between it and Apple's root. */
export interface PassSigner {
  certificate: forge.pki.Certificate;
  key: forge.pki.rsa.PrivateKey;
  chain: forge.pki.Certificate[];
  /** Read off the certificate itself, so they cannot disagree with it: Wallet checks that they match. */
  passTypeIdentifier: string;
  teamIdentifier: string;
}

// The attribute Apple puts the Pass Type ID in ("userId").
const UID = "0.9.2342.19200300.100.1.1";

/**
 * Opens a .p12 (base64) holding the Pass Type ID certificate and its key. Any other
 * certificates in the file are kept as the chain.
 */
export function readSigner(p12Base64: string, password: string): PassSigner {
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.decode64(p12Base64.replace(/\s+/g, ""))), password);
  const bags = (type: string) => p12.getBags({ bagType: type })[type] ?? [];
  const key = [...bags(forge.pki.oids.pkcs8ShroudedKeyBag), ...bags(forge.pki.oids.keyBag)][0]?.key as forge.pki.rsa.PrivateKey | undefined;
  const certificates = bags(forge.pki.oids.certBag)
    .map((bag) => bag.cert)
    .filter((cert): cert is forge.pki.Certificate => Boolean(cert));
  if (!key) throw new Error("wallet: the .p12 holds no private key");

  // The certificate that belongs to the key is the one with the same public half.
  const certificate = certificates.find((cert) => (cert.publicKey as forge.pki.rsa.PublicKey).n.equals(key.n));
  if (!certificate) throw new Error("wallet: the .p12 holds no certificate for its key");

  const passTypeIdentifier = String(certificate.subject.getField({ type: UID })?.value ?? "");
  const teamIdentifier = String(certificate.subject.getField("OU")?.value ?? "");
  if (!passTypeIdentifier || !teamIdentifier) throw new Error("wallet: this is not a Pass Type ID certificate");

  return { certificate, key, chain: certificates.filter((cert) => cert !== certificate), passTypeIdentifier, teamIdentifier };
}

/** A certificate file from Apple (.cer, DER). */
export function readCertificate(der: Buffer): forge.pki.Certificate {
  return forge.pki.certificateFromAsn1(forge.asn1.fromDer(der.toString("binary")));
}

/** A detached PKCS #7 signature of the manifest, as Wallet expects it. */
function sign(manifest: Buffer, signer: PassSigner, at: Date): Buffer {
  const signed = forge.pkcs7.createSignedData();
  signed.content = forge.util.createBuffer(manifest.toString("binary"));
  signed.addCertificate(signer.certificate);
  for (const link of signer.chain) signed.addCertificate(link);
  signed.addSigner({
    key: signer.key,
    certificate: signer.certificate,
    // SHA-1, as Apple's own signing tool and the common libraries use for this signature.
    digestAlgorithm: forge.pki.oids.sha1,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      // forge takes a Date here; its types say string.
      { type: forge.pki.oids.signingTime, value: at as unknown as string },
    ],
  });
  signed.sign({ detached: true });
  return Buffer.from(forge.asn1.toDer(signed.toAsn1()).getBytes(), "binary");
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A zip with every file stored as it is. The files are a few kilobytes; nothing is gained by packing them. */
function zip(files: [string, Buffer][], at: Date): Buffer {
  const time = (at.getUTCHours() << 11) | (at.getUTCMinutes() << 5) | (at.getUTCSeconds() >> 1);
  const date = ((at.getUTCFullYear() - 1980) << 9) | ((at.getUTCMonth() + 1) << 5) | at.getUTCDate();
  const parts: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;

  for (const [name, data] of files) {
    const file = Buffer.from(name, "utf8");
    const sum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(sum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(file.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, file, data);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4); // version made by
    entry.writeUInt16LE(20, 6); // version needed
    entry.writeUInt16LE(0, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt16LE(time, 12);
    entry.writeUInt16LE(date, 14);
    entry.writeUInt32LE(sum, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(file.length, 28);
    entry.writeUInt32LE(offset, 42);
    directory.push(entry, file);

    offset += local.length + file.length + data.length;
  }

  const central = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, central, end]);
}

/**
 * Builds the .pkpass. `pass` is pass.json without the two identifiers, which are taken from
 * the certificate; `pictures` are the icon and logo files by name.
 */
export function buildPkpass({
  pass,
  pictures,
  signer,
  at = new Date(),
}: {
  pass: Record<string, unknown>;
  pictures: Record<string, Buffer>;
  signer: PassSigner;
  at?: Date;
}): Buffer {
  const files: [string, Buffer][] = [
    [
      "pass.json",
      Buffer.from(JSON.stringify({ ...pass, formatVersion: 1, passTypeIdentifier: signer.passTypeIdentifier, teamIdentifier: signer.teamIdentifier }), "utf8"),
    ],
    ...Object.entries(pictures),
  ];
  const manifest = Buffer.from(
    JSON.stringify(Object.fromEntries(files.map(([name, data]) => [name, createHash("sha1").update(data).digest("hex")]))),
    "utf8",
  );
  return zip([...files, ["manifest.json", manifest], ["signature", sign(manifest, signer, at)]], at);
}
