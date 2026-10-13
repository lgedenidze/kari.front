// Storing a pass at Google, so that the link that offers it has only its id to carry
// (lib/google-pass.ts says why).
//
// Three things are asked of Google, each a plain request:
//   1. a token to speak with: the service account signs a request for one, good for an hour;
//   2. the pass, stored — and when it is already there, stored again, so that a name or a
//      language that has changed since is what the phone is offered;
//   3. the class the pass is of, the first time: Google will not take a pass of a class it has
//      not been told about.
//
// It knows nothing of tickets, and it does not reach for the network itself: whoever calls
// hands it the way to send (`send`), which is how it is tested without Google.

import { googleClassId, signGoogleToken, type GoogleIssuer, type GooglePass } from "./google-pass";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://walletobjects.googleapis.com/walletobjects/v1";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";

export type Send = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{ status: number; text(): Promise<string> }>;

export class GoogleWalletError extends Error {}

// One token per service account, kept until a minute before Google stops taking it.
const tokens = new Map<string, { value: string; until: number }>();

async function accessToken(issuer: GoogleIssuer, now: number, send: Send): Promise<string> {
  const kept = tokens.get(issuer.email);
  if (kept && kept.until > now) return kept.value;

  const seconds = Math.floor(now / 1000);
  const assertion = signGoogleToken({ iss: issuer.email, scope: SCOPE, aud: TOKEN_URL, iat: seconds, exp: seconds + 3600 }, issuer.privateKey);
  const answer = await send(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
  });
  const body = await answer.text();
  if (answer.status !== 200) throw new GoogleWalletError(`Google gave no token (${answer.status}): ${body.slice(0, 300)}`);
  const token = JSON.parse(body) as { access_token: string; expires_in?: number };
  tokens.set(issuer.email, { value: token.access_token, until: now + ((token.expires_in ?? 3600) - 60) * 1000 });
  return token.access_token;
}

/** Stores the pass at Google, or stores it again if it is there. Throws when Google will not have it. */
export async function storeGooglePass({ pass, issuer, now, send }: { pass: GooglePass; issuer: GoogleIssuer; now: number; send: Send }): Promise<void> {
  const token = await accessToken(issuer, now, send);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const body = JSON.stringify(pass);
  const insert = () => send(`${API}/genericObject`, { method: "POST", headers, body });

  let answer = await insert();
  if (answer.status === 409) {
    // Already there: this member's card, or this ticket, added once before.
    answer = await send(`${API}/genericObject/${encodeURIComponent(String(pass.id))}`, { method: "PUT", headers, body });
  } else if (answer.status === 400 || answer.status === 404) {
    // Most likely the very first pass: its class is not at Google yet. Say what the class is
    // (that it is there already is no error) and try once more.
    const made = await send(`${API}/genericClass`, { method: "POST", headers, body: JSON.stringify({ id: googleClassId(issuer.id) }) });
    if (made.status !== 200 && made.status !== 409) throw new GoogleWalletError(`Google would not take the class (${made.status}): ${(await made.text()).slice(0, 300)}`);
    answer = await insert();
    // Two first passes at once: the other one made the class and, perhaps, this very pass.
    if (answer.status === 409) answer = await send(`${API}/genericObject/${encodeURIComponent(String(pass.id))}`, { method: "PUT", headers, body });
  }
  if (answer.status !== 200) throw new GoogleWalletError(`Google would not take the pass (${answer.status}): ${(await answer.text()).slice(0, 300)}`);
}

/** For tests: forget every token kept. */
export function forgetGoogleTokens() {
  tokens.clear();
}
