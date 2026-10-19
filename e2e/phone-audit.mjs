// Photographs every screen at phone size, for a design review.
//
//   node e2e/phone-audit.mjs            # 375px wide, into test-results/phone/
//   node e2e/phone-audit.mjs 360        # another width
//
// Needs the web app on :3000 and the API on :5080 against the throwaway database
// (see playwright.config.ts). It creates its own people, like the end-to-end tests do.
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(here, "../../api/src/Kari.Api/appsettings.Development.json"), "utf8")).Kari.Seed;
const base = process.env.BASE_URL ?? "http://localhost:3000";
const width = Number(process.argv[2] ?? 375);
const out = join(here, "../test-results/phone");
mkdirSync(out, { recursive: true });

const run = Date.now() % 1_000_000;
const phone = () => `5${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
const PASSWORD = "audit-guest-password";

const browser = await chromium.launch();
let index = 0;

async function context(lang = "ka") {
  const ctx = await browser.newContext({
    viewport: { width, height: 760 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addCookies([{ name: "kari_lang", value: lang, url: base }]);
  return ctx;
}

async function shot(page, name, { full = false, settle = 700 } = {}) {
  await page.waitForTimeout(settle);
  index += 1;
  const file = join(out, `${String(index).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: full });
  // A page wider than the phone is a bug in itself: report it.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`${String(index).padStart(2, "0")} ${name}${overflow > 0 ? `   <-- scrolls sideways by ${overflow}px` : ""}`);
}

async function signIn(ctx, who, password) {
  const page = await ctx.newPage();
  const response = await page.request.post(`${base}/api/auth/login`, { data: { phone: who, password } });
  if (!response.ok()) throw new Error(`sign-in failed for ${who}: ${response.status()}`);
  return page;
}

// ---- signed out
const visitor = await (await context()).newPage();
await visitor.goto(`${base}/`);
await shot(visitor, "landing-top");
await shot(visitor, "landing-full", { full: true });
await visitor.goto(`${base}/join`);
await shot(visitor, "join", { full: true });
await visitor.goto(`${base}/login`);
await shot(visitor, "login", { full: true });
await visitor.goto(`${base}/privacy`);
await shot(visitor, "privacy");

// ---- a guest, from request to ticket
const guestCtx = await context();
const guest = await guestCtx.newPage();
const me = await (
  await guest.request.post(`${base}/api/auth/register`, {
    data: {
      firstName: "ნინო", lastName: "აბაშიძე", phone: phone(), password: PASSWORD,
      profileUrl: `nino.audit.${run}`, lang: "ka", adult: true, consent: true,
    },
  })
).json();
await guest.goto(`${base}/pass`);
await shot(guest, "pass-pending");

const adminCtx = await context();
const admin = await signIn(adminCtx, seed.AdminPhone, seed.AdminPassword);
await admin.request.post(`${base}/api/admin/users/${me.id}/review`, { data: { decision: "approve" } });
await admin.request.patch(`${base}/api/admin/users/${me.id}`, { data: { inviteMode: "on", staffNotes: "მეგობარია, VIP მაგიდა" } });

await guest.reload();
await shot(guest, "pass-claim");
await guest.request.post(`${base}/api/pass/claim`, { data: {} });
await guest.reload();
await shot(guest, "pass-ticket", { full: true });

await guest.goto(`${base}/invites`);
await shot(guest, "invites", { full: true });
const tonight = (await (await guest.request.get(`${base}/api/pass/tonight`)).json()).tonight.night;
const invite = await (
  await guest.request.post(`${base}/api/invites`, {
    data: { night: tonight, firstName: "დავით", lastName: "ჩხეიძე", personalNumber: "01024012345" },
  })
).json();
await guest.reload();
await shot(guest, "invites-sent", { full: true });
await guest.goto(`${base}/profile`);
await shot(guest, "profile", { full: true });

// ---- the invited guest, with no account
const invited = await (await context()).newPage();
await invited.goto(`${base}/i/${invite.code}`);
await shot(invited, "invite-link", { full: true });

// ---- the door
const staff = await signIn(await context(), seed.StaffPhone, seed.StaffPassword);
await staff.goto(`${base}/door`);
await shot(staff, "door-scan");
// The tab, not the "find by name" button the scanner offers when there is no camera.
await staff.getByRole("navigation", { name: "კარი" }).getByRole("button", { name: "ძებნა" }).click();
await staff.getByRole("searchbox").fill("აბაშიძე");
await shot(staff, "door-find", { settle: 1200 });
await staff.locator("main ul li button").first().click();
await shot(staff, "door-result", { settle: 900 });
await staff.getByRole("button", { name: "უარი", exact: true }).click();
await shot(staff, "door-deny");
await staff.getByRole("button", { name: "უკან" }).click();
await staff.getByRole("button", { name: "შემოშვება" }).click();
await shot(staff, "door-after-admit", { settle: 1600 });
await staff.getByRole("button", { name: "სია" }).click();
await shot(staff, "door-log");
await staff.getByRole("button", { name: "სკანერი" }).click();
await staff.getByRole("button", { name: "ბილეთი კართან" }).click();
await shot(staff, "door-walk-in", { full: true });

// ---- the back office
for (const tab of ["tonight", "requests", "people", "nights", "log", "settings"]) {
  await admin.goto(`${base}/admin#${tab}`);
  await admin.reload();
  await shot(admin, `admin-${tab}`, { full: true, settle: 1500 });
}
await admin.goto(`${base}/admin#people`);
await admin.reload();
await admin.getByRole("button", { name: /ნინო აბაშიძე/ }).first().click();
await shot(admin, "admin-person", { full: true, settle: 1200 });

await browser.close();
console.log(`\nSaved to ${out}`);
