import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GOOGLE_SAVE_URL, SAFE_TOKEN_LENGTH, googleCard, googleSaveLink, googleTicket, type GoogleIssuer } from "./google-pass";
import type { MemberCard, Ticket } from "./types";

// A key made on the spot stands in for the service account's: Google is never asked.
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const issuer: GoogleIssuer = {
  id: "3388000000022222222",
  email: "kari-wallet@kari-test.iam.gserviceaccount.com",
  privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};
const site = "https://kari.example";

const card: MemberCard = { code: "7K2M9QX", token: "KM.7K2M9QX", firstName: "ნინო", lastName: "აბაშიძე", since: "2025-12-31T20:30:00Z" };
const ticket: Ticket = {
  publicId: "V7FQPBJ2DZX2B1WF",
  shortCode: "5RC1SV",
  kind: "guest",
  night: "2026-10-13",
  nightTitle: null,
  firstName: "გიგი",
  lastName: "ბაბილაშვილი",
  inviterName: "Keti Dolidze",
  key: "not-in-the-pass",
  status: "active",
  admittedAt: null,
  endsAt: "2026-10-14T07:00:00+04:00",
  accessToken: null,
};

type Row = { id: string; header: string; body: string };
const rows = (pass: Record<string, unknown>) => (pass.textModulesData as Row[]).map((row) => [row.id, row.header, row.body]);
const words = (field: unknown) => (field as { defaultValue: { value: string } }).defaultValue.value;

/** Opens a save link the way Google would: checks the signature, then reads what was signed. */
function open(link: string) {
  expect(link.startsWith(GOOGLE_SAVE_URL)).toBe(true);
  const token = link.slice(GOOGLE_SAVE_URL.length);
  const [header, claims, signature] = token.split(".");
  expect(createVerify("RSA-SHA256").update(`${header}.${claims}`).verify(publicKey, signature, "base64url")).toBe(true);
  const read = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  return { token, header: read(header), claims: read(claims) };
}

describe("a member's card in Google Wallet", () => {
  const pass = googleCard({ card, issuerId: issuer.id, site, lang: "ka" });

  it("is one card per member, of the bar's one class", () => {
    expect(pass.id).toBe("3388000000022222222.card-7K2M9QX");
    expect(pass.classId).toBe("3388000000022222222.kari");
    expect(pass.state).toBe("ACTIVE");
  });

  it("says the same as the card in an iPhone's Wallet, in Google's four places", () => {
    expect(words(pass.cardTitle)).toBe("KARI");
    expect(words(pass.subheader)).toBe("წევრი");
    expect(words(pass.header)).toBe("ნინო აბაშიძე");
    expect(rows(pass)).toEqual([
      ["row2left", "მოქმედებს", "ყოველ ღამე"],
      ["row2right", "წევრია", "2026 წლიდან"],
      ["row3left", "powered by", "wox.ge"],
    ]);
  });

  it("carries the member's own code, the one the door reads as the member, and never runs out", () => {
    expect(pass.barcode).toEqual({ type: "QR_CODE", value: "KM.7K2M9QX", alternateText: "7K2M9QX" });
    expect(pass.validTimeInterval).toBeUndefined();
  });

  it("is the app's ink, with the mark Google fetches from the site — and no picture of the name", () => {
    expect(pass.hexBackgroundColor).toBe("#14235e");
    expect(pass.logo).toEqual({ sourceUri: { uri: "https://kari.example/wallet/google-logo.png" } });
    // A picture at a public address must not have a name on it.
    expect(pass.heroImage).toBeUndefined();
  });
});

describe("a ticket in Google Wallet", () => {
  const doors = { open: "21:00", close: "04:00" };
  const pass = googleTicket({ ticket, issuerId: issuer.id, site, lang: "ka", doors });

  it("is for one night, and leaves with it", () => {
    expect(pass.id).toBe("3388000000022222222.ticket-V7FQPBJ2DZX2B1WF");
    expect(pass.validTimeInterval).toEqual({ end: { date: "2026-10-14T07:00:00+04:00" } });
    expect(rows(pass)).toEqual([
      ["row2left", "თარიღი", "სამ, 13 ოქტ"],
      ["row2right", "კარი", "21:00–04:00"],
      ["row3left", "powered by", "wox.ge"],
    ]);
  });

  it("names the guest and the member who invited them", () => {
    expect(words(pass.header)).toBe("გიგი ბაბილაშვილი");
    expect(words(pass.subheader)).toBe("მომწვევი: Keti Dolidze");
  });

  it("carries the short code and nothing that admits by itself", () => {
    expect(pass.barcode).toEqual({ type: "QR_CODE", value: "5RC1SV", alternateText: "5RC1SV" });
    expect(JSON.stringify(pass)).not.toContain(ticket.key);
  });

  it("says when it runs out where the page does not know the doors, and gives a named night its place", () => {
    const walkIn = googleTicket({ ticket: { ...ticket, kind: "door", inviterName: null }, issuerId: issuer.id, site, lang: "ka" });
    expect(rows(walkIn)[1]).toEqual(["row2right", "მოქმედებს", "07:00-მდე"]);

    const named = googleTicket({ ticket: { ...ticket, nightTitle: "Chibukhi night" }, issuerId: issuer.id, site, lang: "en", doors });
    expect(rows(named).slice(2)).toEqual([
      ["row3left", "Night", "Chibukhi night"],
      ["row3right", "powered by", "wox.ge"],
    ]);
  });
});

describe("the link that offers a pass to Google Wallet", () => {
  const pass = googleCard({ card, issuerId: issuer.id, site, lang: "ka" });
  const now = Date.UTC(2026, 9, 13, 21, 0, 0);
  const { header, claims, token } = open(googleSaveLink({ pass, issuer, site, now }));

  it("is signed by the service account, for Google, as a pass to save", () => {
    expect(header).toEqual({ alg: "RS256", typ: "JWT" });
    expect(claims).toMatchObject({ iss: issuer.email, aud: "google", typ: "savetowallet", iat: now / 1000, origins: ["kari.example"] });
  });

  it("names the pass and carries nothing of it: no name in an address", () => {
    expect(claims.payload).toEqual({ genericObjects: [{ id: "3388000000022222222.card-7K2M9QX", classId: "3388000000022222222.kari" }] });
    expect(JSON.stringify(claims)).not.toContain("ნინო");
  });

  it("is not signed by anyone else", () => {
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const [signed, signature] = [token.slice(0, token.lastIndexOf(".")), token.slice(token.lastIndexOf(".") + 1)];
    expect(createVerify("RSA-SHA256").update(signed).verify(other.publicKey, signature, "base64url")).toBe(false);
  });

  it("stays well within what Google asks of a link, whatever the pass says", () => {
    // Georgian is three bytes a letter. With the pass in the link, a member's card with a
    // short name came to 1715 characters and a guest's ticket to 1846; Google asks for 1800.
    const long: Ticket = { ...ticket, firstName: "ა".repeat(60), lastName: "ბ".repeat(60), inviterName: `${"გ".repeat(60)} ${"დ".repeat(60)}`, nightTitle: "ე".repeat(80) };
    const link = googleSaveLink({ pass: googleTicket({ ticket: long, issuerId: issuer.id, site, lang: "ka" }), issuer, site, now });
    expect(link.length - GOOGLE_SAVE_URL.length).toBeLessThan(SAFE_TOKEN_LENGTH / 2);
  });

  it("can carry the pass whole, and the class it is of, when nothing could be stored at Google", () => {
    const whole = open(googleSaveLink({ pass, issuer, site, now, whole: true })).claims;
    expect(whole.payload.genericClasses).toEqual([{ id: "3388000000022222222.kari" }]);
    expect(whole.payload.genericObjects).toEqual([JSON.parse(JSON.stringify(pass))]);
  });
});
