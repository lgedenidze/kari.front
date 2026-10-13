import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type APIResponse, type Browser, type Page } from "@playwright/test";

// The ticket as a picture: what the "Download ticket" button hands over.

const seed = JSON.parse(readFileSync(join(__dirname, "../../api/src/Kari.Api/appsettings.json"), "utf8")).Kari.Seed as {
  AdminPhone: string;
  AdminPassword: string;
  StaffPhone: string;
  StaffPassword: string;
};

const run = Date.now() % 1_000_000;

async function signedIn(browser: Browser, phone: string, password: string): Promise<Page> {
  const context = await browser.newContext();
  await context.addCookies([{ name: "kari_lang", value: "en", url: "http://localhost:3000" }]);
  const page = await context.newPage();
  expect((await page.request.post("/api/auth/login", { data: { phone, password } })).ok()).toBe(true);
  return page;
}

/** A member approved by the bar, holding tonight's pass — or null when the bar is closed tonight. */
async function memberWithPass(browser: Browser): Promise<{ page: Page; shortCode: string } | null> {
  const context = await browser.newContext();
  await context.addCookies([{ name: "kari_lang", value: "en", url: "http://localhost:3000" }]);
  const page = await context.newPage();
  const registered = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Mariam",
      lastName: `Picture${run}`,
      phone: `5${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
      password: "e2e-guest-password",
      profileUrl: `mariam.picture.${run}.${Math.floor(Math.random() * 1e6)}`,
      lang: "en",
      adult: true,
      consent: true,
    },
  });
  expect(registered.ok()).toBe(true);
  const me = (await registered.json()) as { id: string };
  const admin = await signedIn(browser, seed.AdminPhone, seed.AdminPassword);
  expect((await admin.request.post(`/api/admin/users/${me.id}/review`, { data: { decision: "approve" } })).ok()).toBe(true);

  const claimed = await page.request.post("/api/pass/claim", { data: {} });
  if (!claimed.ok()) return null;
  const { ticket } = (await claimed.json()) as { ticket: { shortCode: string } };
  return { page, shortCode: ticket.shortCode };
}

/** Checks that a response really is the picture: a PNG, phone-shaped, served as a download. */
async function expectTicketPicture(response: APIResponse, shortCode: string) {
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  expect(response.headers()["content-disposition"]).toBe(`attachment; filename="kari-${shortCode}.png"`);
  // One person's ticket must never sit in a shared cache.
  expect(response.headers()["cache-control"]).toContain("private");

  const body = await response.body();
  expect(body.length).toBeGreaterThan(40_000);
  expect(body.subarray(1, 4).toString("latin1")).toBe("PNG");
  // The size is in the first chunk: 1080 wide, 1920 tall.
  expect(body.readUInt32BE(16)).toBe(1080);
  expect(body.readUInt32BE(20)).toBe(1920);
}

test("a member downloads tonight's pass as a picture", async ({ browser }) => {
  const member = await memberWithPass(browser);
  test.skip(member === null, "the bar is closed tonight in this database: there is no pass to draw");
  const { page, shortCode } = member!;

  await expectTicketPicture(await page.request.get("/pass/ticket.png"), shortCode);

  // And through the button, as a guest would.
  await page.goto("/pass");
  const button = page.getByRole("button", { name: "Download ticket" });
  await expect(button).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
  expect(download.suggestedFilename()).toBe(`kari-${shortCode}.png`);
});

test("the picture of a pass is only for whoever holds it", async ({ browser }) => {
  const stranger = await (await browser.newContext()).newPage();
  expect((await stranger.request.get("/pass/ticket.png", { maxRedirects: 0 })).status()).toBe(404);
  expect((await stranger.request.get("/t/not-a-real-token/ticket.png")).status()).toBe(404);
  expect((await stranger.request.get("/i/not-a-real-code/ticket.png")).status()).toBe(404);
});

test("a ticket issued at the door has its picture too, with no account", async ({ browser }) => {
  const staff = await signedIn(browser, seed.StaffPhone, seed.StaffPassword);
  const issued = await staff.request.post("/api/door/walk-in", {
    data: { firstName: "Giorgi", lastName: `Walkin${run}`, personalNumber: "" },
  });
  expect(issued.ok()).toBe(true);
  const { ticketToken, pass } = (await issued.json()) as { ticketToken: string; pass: { shortCode: string } };

  // The walk-in's own phone: no session at all.
  const walkIn = await (await browser.newContext()).newPage();
  await expectTicketPicture(await walkIn.request.get(`/t/${ticketToken}/ticket.png`), pass.shortCode);
});

test("the door finds a guest from the short code a saved ticket carries", async ({ browser }) => {
  // This is the lookup the scanner makes when it reads a saved ticket's QR (lib/saved-ticket.ts).
  const staff = await signedIn(browser, seed.StaffPhone, seed.StaffPassword);
  const issued = await staff.request.post("/api/door/walk-in", {
    data: { firstName: "Tamar", lastName: `Saved${run}`, personalNumber: "" },
  });
  expect(issued.ok()).toBe(true);
  const { pass } = (await issued.json()) as { pass: { id: string; shortCode: string } };

  const found = await staff.request.get(`/api/door/search?q=${pass.shortCode}`);
  expect(found.ok()).toBe(true);
  const hits = (await found.json()) as { passId: string | null; name: string }[];
  expect(hits.map((hit) => hit.passId)).toContain(pass.id);

  const sheet = await staff.request.get(`/api/door/pass/${pass.id}`);
  expect(sheet.ok()).toBe(true);
  expect(((await sheet.json()) as { person: { lastName: string } }).person.lastName).toBe(`Saved${run}`);
});

// "Add to Apple Wallet". It needs the bar's Pass Type ID certificate from Apple, which is a
// secret and is on no machine by default — so this test holds whichever is true here: with
// no certificate there is no badge and no file; with one, an iPhone is offered the badge and
// the file behind it is a pass. Either way the badge is offered exactly when the file exists.
test("an iPhone is offered Apple Wallet exactly when a pass can be made, and no other phone is", async ({ browser, playwright }) => {
  const member = await memberWithPass(browser);
  test.skip(member === null, "the bar is closed tonight in this database: there is no pass to keep");
  const { page: holder, shortCode } = member!;

  const file = await holder.request.get("/pass/wallet.pkpass");
  const made = file.status() === 200;
  expect([200, 404]).toContain(file.status());

  // The same person on an iPhone.
  const iphone = await browser.newContext({ ...playwright.devices["iPhone 14"], storageState: await holder.context().storageState() });
  const onIphone = await iphone.newPage();
  await onIphone.goto("/pass");
  await expect(onIphone.getByRole("button", { name: "Download ticket" })).toBeVisible();
  const badge = onIphone.getByRole("link", { name: "Add to Apple Wallet" });
  await expect(badge).toHaveCount(made ? 1 : 0);

  // An Android phone is never offered it.
  await holder.goto("/pass");
  await expect(holder.getByRole("button", { name: "Download ticket" })).toBeVisible();
  await expect(holder.getByRole("link", { name: "Add to Apple Wallet" })).toHaveCount(0);

  // Nobody else's pass, with or without a certificate.
  const stranger = await (await browser.newContext()).newPage();
  expect((await stranger.request.get("/pass/wallet.pkpass", { maxRedirects: 0 })).status()).toBe(404);
  expect((await stranger.request.get("/t/not-a-real-token/wallet.pkpass")).status()).toBe(404);
  expect((await stranger.request.get("/i/not-a-real-code/wallet.pkpass")).status()).toBe(404);

  if (!made) return;
  // The type is what makes Safari offer "Add" instead of saving a file.
  await expect(badge).toHaveAttribute("href", "/pass/wallet.pkpass");
  expect(file.headers()["content-type"]).toBe("application/vnd.apple.pkpass");
  expect(file.headers()["content-disposition"]).toBe(`attachment; filename="kari-${shortCode}.pkpass"`);
  expect(file.headers()["cache-control"]).toContain("private");
  const body = await file.body();
  expect(body.subarray(0, 2).toString("latin1")).toBe("PK");
  // Its code is the ticket's short code and nothing else: large, clean squares, which the
  // door reads as a lookup. The pass's own key is nowhere in it.
  expect(body.toString("latin1")).toContain(`"message":"${shortCode}"`);
  // The band is drawn for this pass: the holder's name is on it.
  expect(body.toString("latin1")).toContain("strip@3x.png");
});
