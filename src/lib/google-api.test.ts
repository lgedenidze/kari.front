import { createVerify, generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { GoogleWalletError, forgetGoogleTokens, storeGooglePass, type Send } from "./google-api";
import type { GoogleIssuer } from "./google-pass";

// Google is never asked: `send` is a stand-in that answers as Google is documented to, and
// writes down what it was sent.
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const issuer: GoogleIssuer = {
  id: "3388000000022222222",
  email: "kari-wallet@kari-test.iam.gserviceaccount.com",
  privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};
const pass = { id: "3388000000022222222.card-7K2M9QX", classId: "3388000000022222222.kari", header: { defaultValue: { language: "ka", value: "ნინო აბაშიძე" } } };
const now = Date.UTC(2026, 9, 13, 21, 0, 0);

type Sent = { method: string; url: string; headers: Record<string, string>; body?: string };

/** A Google that answers each request in turn from `answers`, keyed by "METHOD path". */
function google(answers: Record<string, number[]>) {
  const sent: Sent[] = [];
  const send: Send = async (url, init) => {
    sent.push({ url, ...init });
    if (url.endsWith("/token")) return { status: 200, text: async () => JSON.stringify({ access_token: "token-1", expires_in: 3600 }) };
    const key = `${init.method} ${new URL(url).pathname.replace("/walletobjects/v1", "")}`;
    const status = answers[key]?.shift();
    if (status === undefined) throw new Error(`not expected: ${key}`);
    return { status, text: async () => JSON.stringify({ error: { message: `answer ${status}` } }) };
  };
  return { sent, send, calls: () => sent.filter((call) => !call.url.endsWith("/token")).map((call) => `${call.method} ${new URL(call.url).pathname.replace("/walletobjects/v1", "")}`) };
}

beforeEach(forgetGoogleTokens);

describe("storing a pass at Google", () => {
  it("asks for a token as the service account, then stores the pass with it", async () => {
    const { sent, send, calls } = google({ "POST /genericObject": [200] });
    await storeGooglePass({ pass, issuer, now, send });

    const [asked, stored] = sent;
    expect(asked.url).toBe("https://oauth2.googleapis.com/token");
    const form = new URLSearchParams(asked.body);
    expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    const [head, claims, signature] = form.get("assertion")!.split(".");
    expect(createVerify("RSA-SHA256").update(`${head}.${claims}`).verify(publicKey, signature, "base64url")).toBe(true);
    expect(JSON.parse(Buffer.from(claims, "base64url").toString("utf8"))).toEqual({
      iss: issuer.email,
      scope: "https://www.googleapis.com/auth/wallet_object.issuer",
      aud: "https://oauth2.googleapis.com/token",
      iat: now / 1000,
      exp: now / 1000 + 3600,
    });

    expect(calls()).toEqual(["POST /genericObject"]);
    expect(stored.url).toBe("https://walletobjects.googleapis.com/walletobjects/v1/genericObject");
    expect(stored.headers.Authorization).toBe("Bearer token-1");
    expect(JSON.parse(stored.body!)).toEqual(pass);
  });

  it("stores a pass that is already there again, so what changed since is what the phone is offered", async () => {
    const { sent, send, calls } = google({ "POST /genericObject": [409], "PUT /genericObject/3388000000022222222.card-7K2M9QX": [200] });
    await storeGooglePass({ pass, issuer, now, send });
    expect(calls()).toEqual(["POST /genericObject", "PUT /genericObject/3388000000022222222.card-7K2M9QX"]);
    expect(JSON.parse(sent.at(-1)!.body!)).toEqual(pass);
  });

  it("tells Google of the class when the very first pass is refused for want of it", async () => {
    const { sent, send, calls } = google({ "POST /genericObject": [400, 200], "POST /genericClass": [200] });
    await storeGooglePass({ pass, issuer, now, send });
    expect(calls()).toEqual(["POST /genericObject", "POST /genericClass", "POST /genericObject"]);
    expect(JSON.parse(sent[2].body!)).toEqual({ id: "3388000000022222222.kari" });
  });

  it("is not troubled by two first passes at once", async () => {
    // The other request made the class, and this very pass, a moment earlier.
    const { send, calls } = google({ "POST /genericObject": [404, 409], "POST /genericClass": [409], "PUT /genericObject/3388000000022222222.card-7K2M9QX": [200] });
    await storeGooglePass({ pass, issuer, now, send });
    expect(calls()).toEqual(["POST /genericObject", "POST /genericClass", "POST /genericObject", "PUT /genericObject/3388000000022222222.card-7K2M9QX"]);
  });

  it("keeps its token for the hour, and asks again when the hour is nearly up", async () => {
    const { sent, send } = google({ "POST /genericObject": [200, 200, 200] });
    await storeGooglePass({ pass, issuer, now, send });
    await storeGooglePass({ pass, issuer, now: now + 30 * 60_000, send });
    expect(sent.filter((call) => call.url.endsWith("/token"))).toHaveLength(1);
    await storeGooglePass({ pass, issuer, now: now + 59.5 * 60_000, send });
    expect(sent.filter((call) => call.url.endsWith("/token"))).toHaveLength(2);
  });

  it("says so when Google will not have the pass, with Google's own reason", async () => {
    const refused = google({ "POST /genericObject": [403] });
    await expect(storeGooglePass({ pass, issuer, now, send: refused.send })).rejects.toThrow(/would not take the pass \(403\).*answer 403/);

    const stillRefused = google({ "POST /genericObject": [400, 400], "POST /genericClass": [200] });
    await expect(storeGooglePass({ pass, issuer, now, send: stillRefused.send })).rejects.toBeInstanceOf(GoogleWalletError);

    const noToken: Send = async () => ({ status: 400, text: async () => '{"error":"invalid_grant"}' });
    forgetGoogleTokens();
    await expect(storeGooglePass({ pass, issuer, now, send: noToken })).rejects.toThrow(/no token \(400\).*invalid_grant/);
  });
});
