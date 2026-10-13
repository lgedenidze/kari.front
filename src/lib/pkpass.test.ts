import { createHash } from "node:crypto";
import forge from "node-forge";
import { describe, expect, it } from "vitest";
import { buildPkpass, readSigner } from "./pkpass";

// A stand-in for Apple's Pass Type ID certificate, made here: a key, a certificate with the
// two fields Apple puts in the subject, and the .p12 that would hold them.
function standIn(): { p12: string; password: string; certificate: forge.pki.Certificate } {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = "01";
  certificate.validity.notBefore = new Date(Date.now() - 60_000);
  certificate.validity.notAfter = new Date(Date.now() + 86_400_000);
  const subject = [
    { type: "0.9.2342.19200300.100.1.1", value: "pass.ge.wox.kari.test" },
    { name: "commonName", value: "Pass Type ID: pass.ge.wox.kari.test" },
    { shortName: "OU", value: "TESTTEAM01" },
  ];
  certificate.setSubject(subject);
  certificate.setIssuer(subject);
  certificate.sign(keys.privateKey, forge.md.sha256.create());
  const password = "stand-in";
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [certificate], password, { algorithm: "3des" });
  return { p12: forge.util.encode64(forge.asn1.toDer(p12).getBytes()), password, certificate };
}

/** Reads back a zip whose files are stored as they are, which is the only kind built here. */
function unzip(zip: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let at = 0;
  while (zip.readUInt32LE(at) === 0x04034b50) {
    const size = zip.readUInt32LE(at + 18);
    const nameLength = zip.readUInt16LE(at + 26);
    const name = zip.subarray(at + 30, at + 30 + nameLength).toString("utf8");
    files.set(name, zip.subarray(at + 30 + nameLength, at + 30 + nameLength + size));
    at += 30 + nameLength + size;
  }
  return files;
}

describe("a Wallet pass", () => {
  const made = standIn();
  const signer = readSigner(made.p12, made.password);
  const pass = buildPkpass({
    pass: { serialNumber: "abc", description: "KARI, წევრი" },
    pictures: { "icon.png": Buffer.from("not really a picture") },
    signer,
    at: new Date("2026-10-13T20:00:00Z"),
  });
  const files = unzip(pass);

  it("takes its two identifiers from the certificate, so they cannot disagree with it", () => {
    expect(signer.passTypeIdentifier).toBe("pass.ge.wox.kari.test");
    expect(signer.teamIdentifier).toBe("TESTTEAM01");
    const json = JSON.parse(files.get("pass.json")!.toString("utf8"));
    expect(json).toMatchObject({
      formatVersion: 1,
      passTypeIdentifier: "pass.ge.wox.kari.test",
      teamIdentifier: "TESTTEAM01",
      serialNumber: "abc",
      description: "KARI, წევრი",
    });
  });

  it("is a zip of the pass, its pictures, a manifest and a signature", () => {
    expect([...files.keys()]).toEqual(["pass.json", "icon.png", "manifest.json", "signature"]);
  });

  it("lists the SHA-1 of every file in the manifest", () => {
    const manifest = JSON.parse(files.get("manifest.json")!.toString("utf8"));
    expect(Object.keys(manifest)).toEqual(["pass.json", "icon.png"]);
    for (const [name, sum] of Object.entries(manifest)) {
      expect(sum).toBe(createHash("sha1").update(files.get(name)!).digest("hex"));
    }
  });

  it("is signed over the manifest by the certificate's key, without the manifest inside the signature", () => {
    const signed = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(files.get("signature")!.toString("binary"))) as unknown as {
      certificates: forge.pki.Certificate[];
      rawCapture: { content?: unknown; signature: string; authenticatedAttributes: forge.asn1.Asn1[] };
    };
    // Detached: Wallet reads the manifest from the zip.
    expect(signed.rawCapture.content).toBeUndefined();
    expect(signed.certificates.map((c) => c.serialNumber)).toContain(made.certificate.serialNumber);

    // The signed attributes carry the manifest's digest…
    const attributes = signed.rawCapture.authenticatedAttributes;
    const digestOf = (attribute: forge.asn1.Asn1) => {
      const [type, values] = attribute.value as forge.asn1.Asn1[];
      return forge.asn1.derToOid(type.value as string) === forge.pki.oids.messageDigest ? ((values.value as forge.asn1.Asn1[])[0].value as string) : null;
    };
    const digest = attributes.map(digestOf).find((value) => value !== null)!;
    expect(Buffer.from(digest, "binary").toString("hex")).toBe(createHash("sha1").update(files.get("manifest.json")!).digest("hex"));

    // …and the signature is the key's, over those attributes.
    const set = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, attributes);
    const hashed = forge.md.sha1.create().update(forge.asn1.toDer(set).getBytes());
    const publicKey = made.certificate.publicKey as forge.pki.rsa.PublicKey;
    expect(publicKey.verify(hashed.digest().getBytes(), signed.rawCapture.signature)).toBe(true);
  });

  it("picks the certificate that fits the key when the file brings others along", () => {
    // As scripts/wallet-certificate.sh builds it: Apple's intermediate rides in the same file.
    const other = standIn();
    const keyBag = forge.pkcs12
      .pkcs12FromAsn1(forge.asn1.fromDer(forge.util.decode64(made.p12)), made.password)
      .getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]![0];
    const both = forge.pkcs12.toPkcs12Asn1(keyBag.key as forge.pki.rsa.PrivateKey, [other.certificate, made.certificate], "two", { algorithm: "3des" });
    const read = readSigner(forge.util.encode64(forge.asn1.toDer(both).getBytes()), "two");
    const modulus = (certificate: forge.pki.Certificate) => (certificate.publicKey as forge.pki.rsa.PublicKey).n;
    expect(modulus(read.certificate).equals(modulus(made.certificate))).toBe(true);
    expect(read.chain).toHaveLength(1);
    expect(modulus(read.chain[0]).equals(modulus(other.certificate))).toBe(true);
  });

  it("will not open with the wrong password", () => {
    expect(() => readSigner(made.p12, "wrong password")).toThrow();
  });
});
