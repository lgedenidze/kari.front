// Saves the downloadable ticket picture for a fresh member, so it can be looked at.
//
//   node e2e/ticket-image.mjs            # into test-results/ticket/
//
// Needs the web app on :3000 and the API on :5080 against the throwaway database.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { request } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(here, "../../api/src/Kari.Api/appsettings.json"), "utf8")).Kari.Seed;
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = join(here, "../test-results/ticket");
mkdirSync(out, { recursive: true });

const run = Date.now() % 1_000_000;
const names = [
  ["ნინო", "აბაშიძე", "ka"],
  ["Alexandre-Konstantine", "Javakhishvili-Grigolashvili", "en"],
];

const admin = await request.newContext({ baseURL: base });
const login = await admin.post("/api/auth/login", { data: { phone: seed.AdminPhone, password: seed.AdminPassword } });
if (!login.ok()) throw new Error(`admin sign-in failed: ${login.status()}`);

for (const [firstName, lastName, lang] of names) {
  // The language is a cookie, and must sit in the jar beside the session — a cookie header
  // set by hand would replace the jar.
  const { hostname } = new URL(base);
  const cookie = { name: "kari_lang", value: lang, domain: hostname, path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" };
  const guest = await request.newContext({ baseURL: base, storageState: { cookies: [cookie], origins: [] } });
  const registered = await guest.post("/api/auth/register", {
    data: {
      firstName,
      lastName,
      phone: `5${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
      password: "ticket-image-password",
      facebookUrl: `ticket.image.${run}.${lang}`,
      lang,
      adult: true,
      consent: true,
    },
  });
  if (!registered.ok()) throw new Error(`register failed: ${registered.status()}`);
  const me = await registered.json();
  await admin.post(`/api/admin/users/${me.id}/review`, { data: { decision: "approve" } });
  const claimed = await guest.post("/api/pass/claim", { data: {} });
  if (!claimed.ok()) {
    console.log(`${lang}: no pass tonight (${claimed.status()}) — the bar is closed in this database`);
    continue;
  }
  const image = await guest.get("/pass/ticket.png");
  const body = await image.body();
  const file = join(out, `ticket-${lang}.png`);
  writeFileSync(file, body);
  console.log(`${lang}: ${image.status()} ${image.headers()["content-type"]} ${body.length} bytes -> ${file}`);
  console.log(`     ${image.headers()["content-disposition"]}`);
  await guest.dispose();
}

// Without a session there is no pass to draw.
const stranger = await request.newContext({ baseURL: base });
console.log(`signed out: ${(await stranger.get("/pass/ticket.png", { maxRedirects: 0 })).status()}`);
await stranger.dispose();
await admin.dispose();
