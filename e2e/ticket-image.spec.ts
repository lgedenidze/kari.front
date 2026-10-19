import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type APIResponse, type Browser, type Page } from "@playwright/test";

// The ticket as a picture: what the "Download ticket" button hands over.

const seed = JSON.parse(readFileSync(join(__dirname, "../../api/src/Kari.Api/appsettings.Development.json"), "utf8")).Kari.Seed as {
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
  const { page } = await member(browser);
  const claimed = await page.request.post("/api/pass/claim", { data: {} });
  if (!claimed.ok()) return null;
  const { ticket } = (await claimed.json()) as { ticket: { shortCode: string } };
  return { page, shortCode: ticket.shortCode };
}

// On the pass page the ticket is `article.ticket`. Its placeholder is a `.ticket` too, and for
// a moment while the page arrives both are in it: a test that asks for `.ticket` then finds
// two, now and again.

/** A member approved by the bar, who has claimed nothing. */
async function member(browser: Browser): Promise<{ page: Page; lastName: string }> {
  const lastName = `Picture${run}${Math.floor(Math.random() * 1e4)}`;
  const context = await browser.newContext();
  await context.addCookies([{ name: "kari_lang", value: "en", url: "http://localhost:3000" }]);
  const page = await context.newPage();
  const registered = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Mariam",
      lastName,
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
  return { page, lastName };
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
//
// What a member keeps in Wallet is their card: one for every night. So it is theirs before
// they have claimed any pass, and the door reads it as the member.
test("a member's pass in Wallet is their card: offered on an iPhone with or without a ticket, and read at the door as the member", async ({ browser, playwright }) => {
  const { page: holder, lastName } = await member(browser);

  const file = await holder.request.get("/pass/wallet.pkpass");
  const made = file.status() === 200;
  expect([200, 404]).toContain(file.status());

  // The same person on an iPhone, holding no pass for tonight: the card is offered all the same.
  const iphone = await browser.newContext({ ...playwright.devices["iPhone 14"], storageState: await holder.context().storageState() });
  const onIphone = await iphone.newPage();
  await onIphone.goto("/pass");
  await expect(onIphone.locator("article.ticket")).toContainText(lastName);
  const badge = onIphone.getByRole("link", { name: "Add to Apple Wallet" });
  await expect(badge).toHaveCount(made ? 1 : 0);

  // With tonight's pass in hand it is still the card that Wallet is offered — once.
  const claimed = await holder.request.post("/api/pass/claim", { data: {} });
  if (claimed.ok()) {
    await onIphone.reload();
    await expect(onIphone.getByRole("button", { name: "Download ticket" })).toBeVisible();
    await expect(badge).toHaveCount(made ? 1 : 0);
  }

  // An Android phone is never offered it.
  await holder.goto("/pass");
  await expect(holder.locator("article.ticket")).toContainText(lastName);
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
  expect(file.headers()["content-disposition"]).toBe('attachment; filename="kari-member.pkpass"');
  expect(file.headers()["cache-control"]).toContain("private");
  const body = (await file.body()).toString("latin1");
  expect(body.slice(0, 2)).toBe("PK");
  // The band is drawn for this card: the holder's name is on it.
  expect(body).toContain("strip@3x.png");
  // It has no night to run out on, and its code is the member's own, the same every time.
  expect(body).not.toContain("expirationDate");
  const token = /"message":"(KM\.[0-9A-Z]{7})"/.exec(body)?.[1];
  expect(token).toBeTruthy();
  expect((await (await holder.request.get("/pass/wallet.pkpass")).body()).toString("latin1")).toContain(`"message":"${token}"`);

  // The scanner reads it as that member. A code that never changes is not proof: it is a
  // lookup, "by hand", and a person decides.
  const staff = await signedIn(browser, seed.StaffPhone, seed.StaffPassword);
  const scan = (await (await staff.request.post("/api/door/scan", { data: { token } })).json()) as {
    verdict: string;
    method: string;
    person: { lastName: string };
  };
  expect(scan.person.lastName).toBe(lastName);
  expect(scan.verdict).toBe("ok");
  expect(scan.method).toBe("manual");
});

test("a guest's pass in Wallet is still a ticket for one night", async ({ browser }) => {
  const staff = await signedIn(browser, seed.StaffPhone, seed.StaffPassword);
  const issued = await staff.request.post("/api/door/walk-in", { data: { firstName: "Tamar", lastName: `Night${run}`, personalNumber: "" } });
  expect(issued.ok()).toBe(true);
  const { ticketToken, pass } = (await issued.json()) as { ticketToken: string; pass: { shortCode: string } };

  const guest = await (await browser.newContext()).newPage();
  const file = await guest.request.get(`/t/${ticketToken}/wallet.pkpass`);
  expect([200, 404]).toContain(file.status());
  if (file.status() !== 200) return;

  expect(file.headers()["content-disposition"]).toBe(`attachment; filename="kari-${pass.shortCode}.pkpass"`);
  const body = (await file.body()).toString("latin1");
  // Its code is the ticket's short code and nothing else, and it leaves with its night.
  expect(body).toContain(`"message":"${pass.shortCode}"`);
  expect(body).toContain("expirationDate");
});

/** What a link to Google Wallet carries: the claims Google will read. */
function offered(response: APIResponse): { payload: { genericObjects: Record<string, unknown>[] } } {
  const link = response.headers()["location"];
  expect(link.startsWith("https://pay.google.com/gp/v/save/")).toBe(true);
  // One person's pass must never sit in a shared cache.
  expect(response.headers()["cache-control"]).toContain("private");
  return JSON.parse(Buffer.from(link.split("/save/")[1].split(".")[1], "base64url").toString("utf8"));
}

// "Add to Google Wallet". It needs the bar's key from Google, which is a secret and is on no
// machine by default — so, as for Apple's, this test holds whichever is true here: with no
// key there is no button and no link; with one, an Android phone is offered Google's button
// and the link behind it goes to Google with the member's card.
test("an Android phone is offered Google Wallet exactly when a pass can be offered, and an iPhone is not", async ({ browser, playwright }) => {
  // The tests' own phone is an Android one.
  const { page: holder, lastName } = await member(browser);

  const answer = await holder.request.get("/pass/google-wallet", { maxRedirects: 0 });
  expect([302, 404]).toContain(answer.status());
  const ready = answer.status() === 302;

  // A member with no pass for tonight: the card is offered all the same.
  await holder.goto("/pass");
  await expect(holder.locator("article.ticket")).toContainText(lastName);
  const badge = holder.getByRole("link", { name: "Add to Google Wallet" });
  await expect(badge).toHaveCount(ready ? 1 : 0);

  // An iPhone is offered its own wallet, never this one.
  const iphone = await browser.newContext({ ...playwright.devices["iPhone 14"], storageState: await holder.context().storageState() });
  const onIphone = await iphone.newPage();
  await onIphone.goto("/pass");
  await expect(onIphone.locator("article.ticket")).toContainText(lastName);
  await expect(onIphone.getByRole("link", { name: "Add to Google Wallet" })).toHaveCount(0);

  // Nobody else's pass, with or without a key.
  const stranger = await (await browser.newContext()).newPage();
  expect((await stranger.request.get("/pass/google-wallet", { maxRedirects: 0 })).status()).toBe(404);
  expect((await stranger.request.get("/t/not-a-real-token/google-wallet", { maxRedirects: 0 })).status()).toBe(404);
  expect((await stranger.request.get("/i/not-a-real-code/google-wallet", { maxRedirects: 0 })).status()).toBe(404);

  if (!ready) return;
  await expect(badge).toHaveAttribute("href", "/pass/google-wallet");
  // Google's own button, in the page's language, at the size Google hands it out in.
  await expect(badge.locator("img")).toHaveAttribute("src", "/wallet/add-to-google-wallet.en.svg");
  expect((await holder.request.get("/wallet/add-to-google-wallet.en.svg")).status()).toBe(200);
  expect((await holder.request.get("/wallet/google-logo.png")).headers()["content-type"]).toBe("image/png");

  // The link names the member's card. Where it could not be stored at Google first — a key
  // Google does not know, as on a machine with a stand-in — it carries the card whole.
  const [card] = offered(answer).payload.genericObjects;
  expect(card.id).toMatch(/^\d+\.card-[0-9A-Z]{7}$/);
  if (card.barcode) {
    expect(card.barcode).toMatchObject({ type: "QR_CODE", value: `KM.${String(card.id).split("card-")[1]}` });
    expect(JSON.stringify(card.header)).toContain(lastName);
    expect(card.validTimeInterval).toBeUndefined();
  }

  // A guest's ticket goes the same way, and stays a ticket for one night.
  const staff = await signedIn(browser, seed.StaffPhone, seed.StaffPassword);
  const issued = await staff.request.post("/api/door/walk-in", { data: { firstName: "Tamar", lastName: `Android${run}`, personalNumber: "" } });
  const { ticketToken, pass } = (await issued.json()) as { ticketToken: string; pass: { shortCode: string } };
  const guest = await stranger.request.get(`/t/${ticketToken}/google-wallet`, { maxRedirects: 0 });
  expect(guest.status()).toBe(302);
  const [ticket] = offered(guest).payload.genericObjects;
  expect(ticket.id).toMatch(/^\d+\.ticket-[0-9A-Z]{16}$/);
  if (ticket.barcode) {
    expect(ticket.barcode).toMatchObject({ type: "QR_CODE", value: pass.shortCode });
    expect(ticket.validTimeInterval).toBeTruthy();
  }
});
