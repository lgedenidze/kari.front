// The rotating code inside a pass QR. This file draws it on the guest's phone;
// api/src/Kari.Api/Domain/PassCode.cs checks it at the door. They must agree byte for byte —
// pass-code.test.ts and PassCodeTests.cs assert the same vector.

export const STEP_SECONDS = 30;
export const PREFIX = "K1";
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function stepAt(unixMs: number): number {
  return Math.floor(unixMs / 1000 / STEP_SECONDS);
}

/** Milliseconds until the code changes. */
export function msUntilNextStep(unixMs: number): number {
  return STEP_SECONDS * 1000 - (unixMs % (STEP_SECONDS * 1000));
}

export function decodeKey(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function importKey(base64url: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", decodeKey(base64url), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export async function codeAt(key: CryptoKey, step: number): Promise<string> {
  // The step as an 8-byte big-endian counter. Steps fit in 32 bits until the year 6053.
  const counter = new ArrayBuffer(8);
  new DataView(counter).setUint32(4, step);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, counter));

  // First 40 bits of the MAC, five bits per character. Forty bits fit exactly in a double, so
  // plain arithmetic is enough — and it runs on phones too old for BigInt.
  let bits = 0;
  for (let i = 0; i < 5; i++) bits = bits * 256 + mac[i];
  let code = "";
  for (let i = 7; i >= 0; i--) code += ALPHABET[Math.floor(bits / 32 ** i) % 32];
  return code;
}

export function formatToken(publicId: string, code: string): string {
  return `${PREFIX}.${publicId}.${code}`;
}
