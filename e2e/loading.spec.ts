import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

// How a screen arrives. These tests slow the server down on purpose, so that every state a
// screen passes through on a bad connection is on screen long enough to be seen and counted.

const seed = JSON.parse(readFileSync(join(__dirname, "../../api/src/Kari.Api/appsettings.Development.json"), "utf8")).Kari.Seed as {
  AdminPhone: string;
  AdminPassword: string;
  StaffPhone: string;
  StaffPassword: string;
};

// The word a screen must never fall back on, in both languages.
const WAITING_WORDS = ["იტვირთება", "Loading"];

async function signedIn(browser: Browser, phone: string, password: string): Promise<Page> {
  const context = await browser.newContext();
  await context.addCookies([{ name: "kari_lang", value: "ka", url: "http://localhost:3000" }]);
  const page = await context.newPage();
  const response = await page.request.post("/api/auth/login", { data: { phone, password } });
  expect(response.ok()).toBe(true);
  return page;
}

/** Holds back every answer from the server: a page being fetched, and each call to the API. */
async function slowServer(page: Page, ms: number) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const isPage = request.headers()["rsc"] !== undefined;
    const isApi = new URL(request.url()).pathname.startsWith("/api/");
    if (isPage || isApi) await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue();
  });
}

interface Seen {
  /** A waiting word was readable on screen at some point. */
  word: boolean;
  /** Every different placeholder that was on screen, in the order they appeared. */
  placeholders: string[];
}

/** Starts noting, on every frame, what the screen is showing. */
async function startWatching(page: Page) {
  await page.evaluate((words) => {
    const seen = { word: false, placeholders: [] as string[] };
    (window as unknown as { seen: typeof seen }).seen = seen;
    const look = () => {
      if ((window as unknown as { seen: typeof seen }).seen !== seen) return; // a newer watch took over
      const text = document.body.innerText;
      if (words.some((word) => text.includes(word))) seen.word = true;
      const shapes = [...document.querySelectorAll("[data-skeleton]")].map((el) => el.getAttribute("data-skeleton")).join("+");
      if (shapes && seen.placeholders.at(-1) !== shapes) seen.placeholders.push(shapes);
      requestAnimationFrame(look);
    };
    look();
  }, WAITING_WORDS);
}

async function whatWasSeen(page: Page): Promise<Seen> {
  return page.evaluate(() => (window as unknown as { seen: Seen }).seen);
}

/** Waits until the screen has stopped waiting: no placeholder left on it. */
async function settled(page: Page) {
  await expect(page.locator("[data-skeleton]")).toHaveCount(0);
}

test("a screen arrives in one step: no waiting word, and never one placeholder after another", async ({ browser }) => {
  const admin = await signedIn(browser, seed.AdminPhone, seed.AdminPassword);
  await admin.goto("/pass");
  await settled(admin);
  await slowServer(admin, 900);

  // Round the whole dock, and back to where it started. An admin has every tab.
  for (const href of ["/invites", "/door", "/admin", "/profile", "/pass", "/invites", "/admin", "/door", "/pass"]) {
    await startWatching(admin);
    await admin.locator(`nav.tab-dock a[href="${href}"]`).click();
    await admin.waitForURL(`**${href}`);
    // Long enough for the page and its first answer to have come through the slow server.
    await admin.waitForTimeout(2600);
    await settled(admin);

    const seen = await whatWasSeen(admin);
    expect(seen.word, `${href} showed a waiting word`).toBe(false);
    expect(seen.placeholders.length, `${href} showed these placeholders in turn: ${seen.placeholders.join(" -> ")}`).toBeLessThanOrEqual(1);
  }
});

test("the back office changes tab without a waiting word, and remembers a tab it has shown", async ({ browser }) => {
  const admin = await signedIn(browser, seed.AdminPhone, seed.AdminPassword);
  await admin.goto("/admin");
  await settled(admin);
  await slowServer(admin, 700);

  const tabs = admin.locator("header nav button");
  const count = await tabs.count();
  expect(count).toBe(6);

  for (let index = 1; index < count; index += 1) {
    await startWatching(admin);
    await tabs.nth(index).click();
    await admin.waitForTimeout(1900);
    await settled(admin);

    const seen = await whatWasSeen(admin);
    expect(seen.word, `tab ${index} showed a waiting word`).toBe(false);
    expect(seen.placeholders.length, `tab ${index}: ${seen.placeholders.join(" -> ")}`).toBeLessThanOrEqual(1);
  }

  // Back to a tab already shown: what it showed is still there, so nothing waits at all.
  for (const index of [1, 3, 5]) {
    await startWatching(admin);
    await tabs.nth(index).click();
    await admin.waitForTimeout(400);
    const seen = await whatWasSeen(admin);
    expect(seen.placeholders, `tab ${index} waited again`).toEqual([]);
  }
});

test("coming back to a tab shows what it last showed, not the state from before", async ({ browser }) => {
  // A member with a pass to print: printing it changes the pass screen.
  const context = await browser.newContext();
  await context.addCookies([{ name: "kari_lang", value: "en", url: "http://localhost:3000" }]);
  const member = await context.newPage();
  const run = Date.now() % 1_000_000;
  const registered = await member.request.post("/api/auth/register", {
    data: {
      firstName: "Lasha",
      lastName: `Back${run}`,
      phone: `5${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
      password: "e2e-guest-password",
      profileUrl: `lasha.back.${run}`,
      lang: "en",
      adult: true,
      consent: true,
    },
  });
  expect(registered.ok()).toBe(true);
  const me = (await registered.json()) as { id: string };

  const admin = await signedIn(browser, seed.AdminPhone, seed.AdminPassword);
  const approved = await admin.request.post(`/api/admin/users/${me.id}/review`, { data: { decision: "approve" } });
  expect(approved.ok()).toBe(true);
  // Inviting is the admin's to hand out; this member needs the Invites tab below.
  expect((await admin.request.patch(`/api/admin/users/${me.id}`, { data: { inviteMode: "on" } })).ok()).toBe(true);

  await member.goto("/pass");
  const print = member.getByRole("button", { name: "Get tonight's pass" });
  const closed = member.getByText("Closed tonight");
  await expect(print.or(closed)).toBeVisible();
  test.skip(await closed.isVisible(), "the bar is closed tonight in this database: there is no pass to print");

  await print.click();
  await expect(member.locator(".ticket svg[data-value^='K1.']")).toBeVisible();

  // Away, and back, on a slow connection. The pass must be there from the first frame —
  // never the button again, even for a moment.
  await slowServer(member, 900);
  await member.locator('nav.tab-dock a[href="/invites"]').click();
  await member.waitForURL("**/invites");
  await member.waitForTimeout(1500);

  await member.evaluate(() => {
    const seen = { button: false };
    (window as unknown as { back: typeof seen }).back = seen;
    const look = () => {
      if (document.body.innerText.includes("Get tonight's pass")) seen.button = true;
      requestAnimationFrame(look);
    };
    look();
  });
  await member.locator('nav.tab-dock a[href="/pass"]').click();
  await member.waitForURL("**/pass");
  await expect(member.locator(".ticket svg[data-value^='K1.']")).toBeVisible();
  await member.waitForTimeout(1500);
  expect(await member.evaluate(() => (window as unknown as { back: { button: boolean } }).back.button)).toBe(false);
});

test("a sheet at the door covers the whole screen, the dock included", async ({ browser }) => {
  const staff = await signedIn(browser, seed.StaffPhone, seed.StaffPassword);
  await staff.goto("/door");
  await staff.getByRole("button", { name: "ბილეთი კართან" }).click();
  const sheet = staff.getByRole("dialog");
  await expect(sheet).toBeVisible();

  const viewport = staff.viewportSize()!;
  const box = (await sheet.boundingBox())!;
  expect(Math.round(box.y)).toBe(0);
  expect(Math.round(box.height)).toBe(viewport.height);

  // Where a thumb rests, over the dock: the sheet must be what is under it.
  const underThumb = await staff.evaluate(() => {
    const at = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 40);
    return { inSheet: Boolean(at?.closest('[role="dialog"]')), inDock: Boolean(at?.closest(".tab-dock")) };
  });
  expect(underThumb).toEqual({ inSheet: true, inDock: false });
});

test("a refresh that fails once says nothing; one that keeps failing does, and the screen keeps its content", async ({ browser }) => {
  const admin = await signedIn(browser, seed.AdminPhone, seed.AdminPassword);
  await admin.goto("/pass");
  await settled(admin);
  const ticket = admin.locator(".ticket").first();
  await expect(ticket).toBeVisible();
  const redBox = admin.locator(".notice-error");

  // How many more answers fail. The pass is asked for every four seconds.
  let failing = 0;
  await admin.route("**/api/pass/tonight", async (route) => {
    if (failing > 0) {
      failing -= 1;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "server_error" }) });
    } else {
      await route.continue();
    }
  });

  // The server has one bad moment. Nobody needs to hear about it.
  await admin.evaluate(() => {
    const seen = { box: false };
    (window as unknown as { quiet: typeof seen }).quiet = seen;
    const look = () => {
      if (document.querySelector(".notice-error")) seen.box = true;
      requestAnimationFrame(look);
    };
    look();
  });
  failing = 1;
  await admin.waitForTimeout(7000);
  expect(await admin.evaluate(() => (window as unknown as { quiet: { box: boolean } }).quiet.box)).toBe(false);
  await expect(ticket).toBeVisible();

  // Now it keeps failing: that is worth saying — under a pass that is still there.
  failing = Number.POSITIVE_INFINITY;
  await expect(redBox).toBeVisible({ timeout: 30_000 });
  await expect(ticket).toBeVisible();

  // And it goes away by itself once the server answers again.
  failing = 0;
  await expect(redBox).toBeHidden({ timeout: 15_000 });
});
