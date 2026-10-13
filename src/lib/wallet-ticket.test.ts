import { describe, expect, it } from "vitest";
import type { Ticket } from "./types";
import { ticketKind, walletTicket } from "./wallet-ticket";

const ticket: Ticket = {
  publicId: "V7FQPBJ2DZX2B1WF",
  shortCode: "5RC1SV",
  kind: "member",
  night: "2026-10-13",
  nightTitle: null,
  firstName: "ნინო",
  lastName: "აბაშიძე",
  inviterName: null,
  key: "not-in-the-pass",
  status: "active",
  admittedAt: null,
  endsAt: "2026-10-14T07:00:00+04:00",
  accessToken: null,
};
const live = "https://kari.example/pass";
const doors = { open: "21:00", close: "04:00" };

type Field = { key: string; label?: string; value: string };
const front = (pass: Record<string, unknown>) =>
  pass.eventTicket as Record<"headerFields" | "secondaryFields" | "auxiliaryFields" | "backFields", Field[]> & { primaryFields?: Field[] };

describe("a ticket in Wallet", () => {
  const pass = walletTicket({ ticket, live, lang: "ka", doors });
  const fields = front(pass);

  it("is ink, with the wordmark picture alone at its head, and the date", () => {
    expect(pass.backgroundColor).toBe("rgb(20, 35, 94)");
    // The name of the bar is in the logo picture; said again as text it would be there twice.
    expect(pass.logoText).toBeUndefined();
    expect(fields.headerFields).toEqual([{ key: "date", label: "თარიღი", value: "სამ, 13 ოქტ" }]);
  });

  it("leaves the name to the band, where it cannot run into anything", () => {
    // Wallet's own name field is set across whatever is behind it; the band draws the name.
    expect(fields.primaryFields).toBeUndefined();
    // It is still said in words: for VoiceOver, and on the back.
    expect(pass.description).toBe("KARI, წევრი, ნინო აბაშიძე");
    expect(fields.backFields[0]).toEqual({ key: "name", label: "წევრი", value: "ნინო აბაშიძე" });
  });

  it("has a stub that says when the doors are open, and who made it", () => {
    expect(fields.secondaryFields.map((field) => [field.label, field.value])).toEqual([
      ["კარი", "21:00–04:00"],
      ["powered by", "wox.ge"],
    ]);
    expect(fields.auxiliaryFields).toEqual([]);
  });

  it("says when the ticket runs out where the page does not know the doors", () => {
    const walkIn = front(walletTicket({ ticket: { ...ticket, kind: "door" }, live, lang: "ka" }));
    expect(walkIn.secondaryFields.map((field) => [field.label, field.value])[0]).toEqual(["მოქმედებს", "07:00-მდე"]);
  });

  it("gives a named night a row to itself and moves the stub down", () => {
    const named = front(walletTicket({ ticket: { ...ticket, nightTitle: "Chibukhi night" }, live, lang: "ka", doors }));
    expect(named.secondaryFields).toEqual([{ key: "title", label: "ღამე", value: "Chibukhi night" }]);
    expect(named.auxiliaryFields.map((field) => field.value)).toEqual(["21:00–04:00", "wox.ge"]);
  });

  it("carries the short code and nothing else as its code, said once", () => {
    // Six characters make a code of large squares; the ticket's address makes a dense one.
    expect(pass.barcodes).toEqual([{ format: "PKBarcodeFormatQR", message: "5RC1SV", messageEncoding: "iso-8859-1", altText: "5RC1SV" }]);
    const everyField = [...fields.headerFields, ...fields.secondaryFields, ...fields.auxiliaryFields];
    expect(everyField.map((field) => field.value)).not.toContain("5RC1SV");
  });

  it("carries nothing that admits by itself, and leaves with its night", () => {
    expect(JSON.stringify(pass)).not.toContain(ticket.key);
    expect(pass.expirationDate).toBe(ticket.endsAt);
    expect(pass.sharingProhibited).toBe(true);
    // On the back: the way to the live ticket, and the maker's link.
    expect(fields.backFields.map((field) => field.value)).toEqual(expect.arrayContaining(["https://kari.example/pass", "https://wox.ge"]));
  });

  it("names the member who invited a guest, in the guest's language", () => {
    const guest: Ticket = { ...ticket, kind: "guest", inviterName: "Keti Dolidze" };
    expect(ticketKind(guest, "en")).toBe("Guest of Keti Dolidze");
    expect(front(walletTicket({ ticket: guest, live, lang: "en" })).headerFields[0]).toMatchObject({ label: "Date", value: "Tue, 13 Oct" });
  });
});
