import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

// The seeded staff and admin logins, read from the API's committed settings.
const seed = JSON.parse(readFileSync(join(__dirname, "../../api/src/Kari.Api/appsettings.json"), "utf8")).Kari.Seed as {
  AdminPhone: string;
  AdminPassword: string;
  StaffPhone: string;
  StaffPassword: string;
};

const PASSWORD = "e2e-guest-password";
const run = Date.now() % 1_000_000;

function newPhone(): string {
  return `5${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
}

async function english(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext();
  await context.addCookies([{ name: "kari_lang", value: "en", url: "http://localhost:3000" }]);
  return context;
}

async function signIn(browser: Browser, phone: string, password: string): Promise<Page> {
  const page = await (await english(browser)).newPage();
  await page.goto("/login");
  await page.getByLabel("Phone number").fill(phone);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/pass");
  return page;
}

/** What the QR on screen encodes right now. */
async function tokenOnScreen(page: Page): Promise<string> {
  const qr = page.locator(".ticket svg[data-value^='K1.']");
  await expect(qr).toBeVisible();
  return (await qr.getAttribute("data-value"))!;
}

test("a guest joins, the bar approves, the door scans and admits, and it is in the log", async ({ browser }) => {
  const first = "Nino";
  const last = `Flow${run}`;

  // 1. The guest asks for access through the real form.
  const guest = await (await english(browser)).newPage();
  await guest.goto("/join");
  await guest.getByLabel("First name").fill(first);
  await guest.getByLabel("Last name").fill(last);
  await guest.getByLabel("Phone number").fill(newPhone());
  // A name on its own is an Instagram name: no link to go and copy.
  await guest.getByLabel("Instagram or Facebook").fill(`@nino.flow.${run}`);
  await guest.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await guest.getByText("I am 18 or older.").click();
  await guest.getByText("I agree that the bar stores").click();
  await guest.getByRole("button", { name: "Send request" }).click();

  await guest.waitForURL("**/pass");
  await expect(guest.getByRole("heading", { name: "Your request is with the bar" })).toBeVisible();

  // 2. The admin sees the request in the queue and approves it.
  const admin = await signIn(browser, seed.AdminPhone, seed.AdminPassword);
  await admin.goto("/admin#requests");
  const request = admin.locator("li", { has: admin.getByRole("heading", { name: `${first} ${last}` }) });
  await expect(request).toBeVisible();
  // The button says which network it opens.
  await expect(request.getByRole("link", { name: "Open Instagram" })).toHaveAttribute(
    "href",
    `https://www.instagram.com/nino.flow.${run}`,
  );
  await request.getByRole("button", { name: "Approve" }).click();
  await expect(request).toBeHidden();

  // 3. The guest's page notices by itself, and they claim tonight's pass.
  await guest.getByRole("button", { name: "Get tonight's pass" }).click();
  await expect(guest.locator(".ticket")).toContainText(first);
  await expect(guest.locator(".ticket")).toContainText(last);
  await expect(guest.getByText("Show this at the door")).toBeVisible();
  const token = await tokenOnScreen(guest);
  expect(token).toMatch(/^K1\.[0-9A-Z]{16}\.[0-9A-Z]{8}$/);

  // 4. The door scans that exact code. (A headless browser has no camera, so the token the
  //    camera would have read is posted the way the scanner posts it.)
  const staff = await signIn(browser, seed.StaffPhone, seed.StaffPassword);
  const scan = await staff.request.post("/api/door/scan", { data: { token } });
  expect(scan.ok()).toBe(true);
  const scanned = await scan.json();
  expect(scanned.verdict).toBe("ok");
  expect(scanned.person.lastName).toBe(last);

  // 5. Staff decide in the real door screen: find the guest, read the card, tap Admit.
  await staff.goto("/door");
  await staff.getByRole("button", { name: "Find" }).click();
  await staff.getByPlaceholder("Name, phone, personal number or code").fill(last);
  await staff.getByRole("button", { name: new RegExp(`${first} ${last}`) }).click();
  const sheet = staff.getByRole("dialog");
  await expect(sheet).toContainText("Valid pass");
  await expect(sheet).toContainText(last);
  await sheet.getByRole("button", { name: "Admit" }).click();
  await expect(sheet).toBeHidden();

  // 6. The guest's phone flips to "in" without a reload.
  await expect(guest.getByText(/You are in since \d\d:\d\d/)).toBeVisible();
  await expect(guest.getByRole("img", { name: "ADMITTED" })).toBeVisible();

  // 7. The decision is in the admin's door log.
  await admin.goto("/admin#log");
  // The tests run at phone size, where the log is a list of records rather than a table.
  const row = admin.locator("main li", { hasText: `${first} ${last}` });
  await expect(row).toContainText("Admitted");
  await expect(row).toContainText("Door Staff");

  // 8. A second scan is a re-entry, not a rejection.
  const again = await (await staff.request.post("/api/door/scan", { data: { token: await tokenOnScreen(guest) } })).json();
  expect(again.verdict).toBe("reentry");
});

test("a member invites a named guest, who gets a ticket with no account", async ({ browser }) => {
  const last = `Host${run}`;

  // A verified member with inviting switched on.
  const host = await (await english(browser)).newPage();
  const register = await host.request.post("/api/auth/register", {
    data: {
      firstName: "Keti", lastName: last, phone: newPhone(), password: PASSWORD,
      profileUrl: `keti.host.${run}`, lang: "en", adult: true, consent: true,
    },
  });
  expect(register.ok()).toBe(true);
  const me = await register.json();

  const admin = await signIn(browser, seed.AdminPhone, seed.AdminPassword);
  expect((await admin.request.post(`/api/admin/users/${me.id}/review`, { data: { decision: "approve" } })).ok()).toBe(true);
  expect((await admin.request.patch(`/api/admin/users/${me.id}`, { data: { inviteMode: "on" } })).ok()).toBe(true);

  // The member fills in the invite: first name, last name, and the optional personal number.
  await host.goto("/invites");
  // The whole form is on the first screen: the button is in view before anything is typed.
  await expect(host.getByRole("button", { name: "Create invite" })).toBeInViewport({ ratio: 1 });
  await host.getByLabel("First name").fill("Davit");
  await host.getByLabel("Last name").fill(`Guest${run}`);
  // The personal number is folded away until it is asked for.
  await host.getByRole("button", { name: "+ Personal number or phone" }).click();
  await host.getByLabel("Personal number").fill("01024012345");
  await host.getByRole("button", { name: "Create invite" }).click();

  // What comes back covers the screen: the link, and nothing else, until it is closed.
  const ready = host.getByRole("dialog", { name: "Invite ready" });
  await expect(ready.getByRole("heading", { name: "Invite ready" })).toBeVisible();
  await expect(ready).toContainText(`Davit Guest${run}`);
  await expect(ready.getByRole("button", { name: "Share" })).toBeVisible();
  const link = await ready.locator("svg[data-value*='/i/']").getAttribute("data-value");
  expect(link).toMatch(/\/i\/[a-z0-9]{14}$/);
  await ready.getByRole("button", { name: "Close" }).click();
  await expect(ready).toBeHidden();
  // Behind it the form is empty again, and the guest is in the list of sent invites.
  await expect(host.getByLabel("First name")).toHaveValue("");
  await expect(host.locator("li", { hasText: `Guest${run}` })).toContainText("Waiting");

  // The guest opens the link in a browser that has never signed in.
  const guest = await (await english(browser)).newPage();
  await guest.goto(new URL(link!).pathname);
  await expect(guest.getByRole("heading", { name: `Keti ${last} invited you` })).toBeVisible();
  await expect(guest.locator(".ticket")).toContainText(`Guest${run}`);
  // The link can be forwarded, so it never shows the whole personal number.
  await expect(guest.locator(".ticket")).toContainText("••••••••345");
  await expect(guest.locator(".ticket")).not.toContainText("01024012345");

  await guest.getByRole("button", { name: "Get my ticket" }).click();
  const token = await tokenOnScreen(guest);

  // At the door: the name, the full personal number to check against an ID, and who vouched.
  const staff = await signIn(browser, seed.StaffPhone, seed.StaffPassword);
  const scanned = await (await staff.request.post("/api/door/scan", { data: { token } })).json();
  expect(scanned.verdict).toBe("ok");
  expect(scanned.person.firstName).toBe("Davit");
  expect(scanned.person.personalNumber).toBe("01024012345");
  expect(scanned.inviter.name).toBe(`Keti ${last}`);

  const decided = await staff.request.post("/api/door/decide", {
    data: { passId: scanned.pass.id, decision: "admitted", verdict: scanned.verdict, method: "scan" },
  });
  expect(decided.ok()).toBe(true);

  await expect(guest.getByText(/You are in since \d\d:\d\d/)).toBeVisible();

  // The member sees that their guest came in.
  await host.reload();
  await expect(host.locator("li", { hasText: `Guest${run}` })).toContainText("Came in");
});

test("staff issue a ticket at the door, and it opens on the walk-in's own phone", async ({ browser }) => {
  const staff = await signIn(browser, seed.StaffPhone, seed.StaffPassword);
  await staff.goto("/door");
  await staff.getByRole("button", { name: "Ticket at the door" }).click();

  const form = staff.getByRole("dialog");
  await form.getByLabel("First name").fill("Aleko");
  await form.getByLabel("Last name").fill(`Walkin${run}`);
  await form.getByRole("button", { name: "Admit and issue ticket" }).click();
  await expect(form.getByRole("heading", { name: "Ticket issued" })).toBeVisible();

  // The QR staff show the walk-in is a link to their own live ticket.
  const link = await form.locator("svg[data-value*='/t/']").getAttribute("data-value");
  const phone = await (await english(browser)).newPage();
  await phone.goto(new URL(link!).pathname);
  await expect(phone.locator(".ticket")).toContainText(`Walkin${run}`);
  await expect(phone.locator(".ticket")).toContainText("Door ticket");
  await expect(phone.getByRole("img", { name: "ADMITTED" })).toBeVisible();

  // Coming back in later, their own code scans as a re-entry.
  const scanned = await (await staff.request.post("/api/door/scan", { data: { token: await tokenOnScreen(phone) } })).json();
  expect(scanned.verdict).toBe("reentry");
});

test("the door and the back office turn everyone else away", async ({ browser }) => {
  const visitor = await (await english(browser)).newPage();
  await visitor.goto("/door");
  await expect(visitor).toHaveURL(/\/login\?next=%2Fdoor$/);
  await visitor.goto("/admin");
  await expect(visitor).toHaveURL(/\/login\?next=%2Fadmin$/);

  // Staff can work the door but not the back office.
  const staff = await signIn(browser, seed.StaffPhone, seed.StaffPassword);
  await staff.goto("/admin");
  await expect(staff).toHaveURL(/\/pass$/);
  expect((await staff.request.get("/api/admin/overview")).status()).toBe(403);
});

test("the public pages are indexable, in both languages", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();

  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ka");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("კარმა შენი სახელი იცის.");
  await expect(page.locator("link[rel='alternate'][hreflang='en']")).toHaveAttribute("href", /\/en$/);
  await expect(page.getByRole("link", { name: /powered by wox\.ge/ }).first()).toBeVisible();

  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The door knows your name.");

  expect((await page.request.get("/sitemap.xml")).ok()).toBe(true);
  const robots = await (await page.request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
});

test("the landing page offers a member their pass, and a guest their ticket, when they come back", async ({ browser }) => {
  // A stranger is asked to request access.
  const stranger = await (await english(browser)).newPage();
  await stranger.goto("/en");
  await expect(stranger.getByRole("link", { name: "Request access" }).first()).toBeVisible();
  await expect(stranger.getByRole("link", { name: "My pass" })).toHaveCount(0);

  // Someone who has signed in on this phone is offered their pass instead.
  const member = await signIn(browser, seed.StaffPhone, seed.StaffPassword);
  await member.goto("/en");
  const pass = member.getByRole("link", { name: "My pass" }).first();
  await expect(pass).toBeVisible();
  await expect(member.getByRole("link", { name: "Request access" })).toHaveCount(0);
  await pass.click();
  await member.waitForURL("**/pass");

  // A walk-in has no account: the phone that opened their ticket is offered it back.
  const issued = await member.request.post("/api/door/walk-in", { data: { firstName: "Back", lastName: `Again${run}` } });
  expect(issued.ok()).toBe(true);
  const { ticketToken } = (await issued.json()) as { ticketToken: string };
  const guest = await (await english(browser)).newPage();
  await guest.goto(`/t/${ticketToken}`);
  await expect(guest.locator(".ticket")).toContainText(`Again${run}`);
  await guest.goto("/en");
  const ticket = guest.getByRole("link", { name: "My ticket" }).first();
  await expect(ticket).toBeVisible();
  await ticket.click();
  await guest.waitForURL(`**/t/${ticketToken}`);
});

test("an admin names a night, and members see it by name", async ({ browser }) => {
  const title = `Opening ${run}`;

  // Six nights from now, as the API counts nights.
  const admin = await signIn(browser, seed.AdminPhone, seed.AdminPassword);
  const week = (await (await admin.request.get("/api/public/venue")).json()).week as { night: string }[];
  const date = week[6].night;

  // The admin adds the night from the back office: pick a date, give it a name, save.
  await admin.goto("/admin#nights");
  await admin.getByRole("button", { name: "Add a night" }).click();
  await admin.getByLabel("Date").fill(date);
  await admin.getByLabel("Name of the night").fill(title);
  await admin.getByLabel("Note for guests").fill("Doors at ten");
  await admin.getByRole("button", { name: "Save changes" }).click();

  const named = admin.locator("#special-nights + ul li", { hasText: title });
  await expect(named).toBeVisible();
  await expect(named).toContainText("Doors at ten");

  // In the plain schedule under it, that night is still one row of two lines: the date with
  // its name, then its hours and its note. At phone size the name used to wrap under the
  // hours and run into them (BUG-0006).
  const scheduled = admin.locator("section[aria-labelledby='schedule'] li", { hasText: title });
  await expect(scheduled).toContainText("Doors at ten");
  expect((await scheduled.boundingBox())!.height).toBeLessThan(80);

  // A member who can invite sees that night by name in the invite calendar.
  const member = await (await english(browser)).newPage();
  const me = await (
    await member.request.post("/api/auth/register", {
      data: {
        firstName: "Lika", lastName: `Named${run}`, phone: newPhone(), password: PASSWORD,
        profileUrl: `lika.named.${run}`, lang: "en", adult: true, consent: true,
      },
    })
  ).json();
  expect((await admin.request.post(`/api/admin/users/${me.id}/review`, { data: { decision: "approve" } })).ok()).toBe(true);
  expect((await admin.request.patch(`/api/admin/users/${me.id}`, { data: { inviteMode: "on" } })).ok()).toBe(true);

  await member.goto("/invites");
  const special = member.getByRole("button", { name: new RegExp(title) }).last();
  await expect(special).toBeVisible();
  await special.click();
  await expect(member.locator("[aria-live='polite']", { hasText: title })).toContainText("Doors at ten");

  // The admin opens it for editing: the form starts from what was saved.
  // (Once the form is open the name is a field's value, not text, so the card is found by
  // its form rather than by its title.)
  await named.getByRole("button", { name: "Edit" }).click();
  const editor = admin.locator("#special-nights + ul form");
  await expect(editor.getByLabel("Name of the night")).toHaveValue(title);
  await editor.getByRole("button", { name: "Cancel" }).click();

  // Deleting asks once, and "Keep it" really keeps it.
  await named.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(named.getByRole("alertdialog")).toContainText("It goes back to the weekly schedule.");
  await named.getByRole("button", { name: "Keep it" }).click();
  await expect(named).toBeVisible();

  // Deleting for real: the night leaves the named list and returns to the plain schedule.
  await named.getByRole("button", { name: "Delete", exact: true }).click();
  await named.getByRole("button", { name: "Delete night" }).click();
  await expect(admin.locator("#special-nights + ul li", { hasText: title })).toHaveCount(0);
  const stillNamed = (await (await admin.request.get("/api/admin/nights")).json()) as { night: string; title: string | null }[];
  expect(stillNamed.find((n) => n.night === date)?.title ?? null).toBeNull();
});

/** Someone asks to join, straight through the API: one more request in the bar's queue. */
async function askToJoin(browser: Browser, first: string, last: string): Promise<void> {
  const context = await english(browser);
  const asked = await context.request.post("/api/auth/register", {
    data: {
      firstName: first,
      lastName: last,
      phone: newPhone(),
      password: PASSWORD,
      profileUrl: `facebook.com/${first}.${last}`.toLowerCase(),
      lang: "en",
      adult: true,
      consent: true,
    },
  });
  expect(asked.ok()).toBe(true);
  await context.close();
}

test("an admin sees how many requests are waiting, on the dock and on the requests tab", async ({ browser }) => {
  const last = `Count${run}`;
  await askToJoin(browser, "Queue", last);

  const admin = await signIn(browser, seed.AdminPhone, seed.AdminPassword);
  const waiting = async () =>
    ((await (await admin.request.get("/api/admin/users?status=pending")).json()) as { total: number }).total;
  const start = await waiting();
  expect(start).toBeGreaterThan(0);

  // On the dock, from any screen — and it comes with the page, not after it.
  const office = admin.getByRole("navigation", { name: "Home" }).getByRole("link", { name: /Office/ });
  const onDock = office.locator("[data-count]");
  await expect(onDock).toHaveAttribute("data-count", String(start));
  expect(await (await admin.request.get("/pass")).text()).toContain(`data-count="${start}"`);
  // The number it arrived with is not news: nothing moves.
  await expect(onDock).not.toHaveClass(/count-thump/);

  // The same number on the requests tab of the back office.
  await office.click();
  await admin.waitForURL("**/admin");
  const onTab = admin.getByRole("navigation", { name: "Back office" }).getByRole("button", { name: /Requests/ }).locator("[data-count]");
  await expect(onTab).toHaveAttribute("data-count", String(start));
  await expect(onDock).toHaveAttribute("data-count", String(start));

  // Someone else asks while the admin has the app open. Coming back to the app asks again,
  // and the new number lands with a thump, in both places.
  await askToJoin(browser, "Later", last);
  await admin.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(onDock).toHaveAttribute("data-count", String(start + 1));
  await expect(onDock).toHaveClass(/count-thump/);
  await expect(onTab).toHaveAttribute("data-count", String(start + 1));

  // An answer takes it out of the count at once, with no reload.
  await admin.getByRole("navigation", { name: "Back office" }).getByRole("button", { name: /Requests/ }).click();
  const request = admin.locator("li", { has: admin.getByRole("heading", { name: `Queue ${last}` }) });
  // This one asked with a Facebook link, and its button says so.
  await expect(request.getByRole("link", { name: "Open Facebook" })).toHaveAttribute("href", `https://www.facebook.com/queue.${last.toLowerCase()}`);
  // A no is asked for twice: the first tap opens the note to the guest and a way back.
  await request.getByRole("button", { name: "Reject" }).click();
  await expect(request.getByPlaceholder("Note for the guest")).toBeVisible();
  await request.getByRole("button", { name: "Back" }).click();
  await expect(request.getByRole("button", { name: "Approve" })).toBeVisible();
  expect(await waiting()).toBe(start + 1);
  await request.getByRole("button", { name: "Reject" }).click();
  await request.getByRole("button", { name: "Reject" }).click();
  await expect(request).toBeHidden();
  await expect(onTab).toHaveAttribute("data-count", String(start));
  await expect(onDock).toHaveAttribute("data-count", String(start));
  expect(await waiting()).toBe(start);

  // The door is not told how long the queue is.
  const staff = await signIn(browser, seed.StaffPhone, seed.StaffPassword);
  expect(((await (await staff.request.get("/api/me")).json()) as { pendingRequests: number }).pendingRequests).toBe(0);
});

test("what the bar changes about a person reaches the app they already have open", async ({ browser }) => {
  const last = `Changed${run}`;

  // A member, approved a moment ago, with their app open on the pass.
  const person = await (await english(browser)).newPage();
  const me = await (
    await person.request.post("/api/auth/register", {
      data: {
        firstName: "Saba", lastName: last, phone: newPhone(), password: PASSWORD,
        profileUrl: `saba.changed.${run}`, lang: "en", adult: true, consent: true,
      },
    })
  ).json();
  const admin = await signIn(browser, seed.AdminPhone, seed.AdminPassword);
  expect((await admin.request.post(`/api/admin/users/${me.id}/review`, { data: { decision: "approve" } })).ok()).toBe(true);
  await person.goto("/pass");
  const dock = person.getByRole("navigation", { name: "Home" });
  await expect(dock.getByRole("link", { name: "Pass" })).toBeVisible();
  await expect(dock.getByRole("link", { name: "Door" })).toHaveCount(0);

  // Picking the phone up again is all the person ever does here: the app comes back into view.
  const lookAgain = () => person.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

  // The admin opens the person in the back office. Each control is saved by the tap itself.
  await admin.goto("/admin#people");
  await admin.getByRole("searchbox").fill(last);
  await admin.getByRole("button", { name: new RegExp(`Saba ${last}`) }).first().click();
  const saved = admin.getByRole("status").filter({ hasText: "Saved" });

  // Door staff: the scanner appears in the dock of the app that was open all along. It used
  // to stay as it was until the person signed in again (BUG-0007).
  await admin.getByRole("radio", { name: "Door" }).click();
  await expect(saved).toBeVisible();
  await lookAgain();
  await expect(dock.getByRole("link", { name: "Door" })).toBeVisible();
  await expect(dock.getByRole("link", { name: "Office" })).toHaveCount(0);

  // Then an admin: the back office appears too.
  await admin.getByRole("radio", { name: "Admin" }).click();
  await expect(admin.getByRole("radio", { name: "Admin" })).toBeChecked();
  await lookAgain();
  await expect(dock.getByRole("link", { name: "Office" })).toBeVisible();

  // Inviting is a permission, and a member has it from the day they are approved: nobody
  // switched it on for this one, and nothing had to be earned first.
  await dock.getByRole("link", { name: "Invites" }).click();
  await expect(person.getByRole("button", { name: "Create invite" })).toBeVisible();
  const invites = admin.getByRole("switch", { name: "Can invite guests" });
  await expect(invites).toBeChecked();

  // The bar takes it away from this one person, with one tap. Their invite form goes.
  await invites.click();
  await expect(invites).not.toBeChecked();
  await expect(person.getByText("Inviting is switched off for your account.")).toBeVisible({ timeout: 15_000 });
  await expect(person.getByRole("button", { name: "Create invite" })).toHaveCount(0);

  // Back to a plain member while they stand at the door's scanner: that screen is no longer
  // theirs, so they are taken to their pass, and the dock has only a member's tabs again.
  await dock.getByRole("link", { name: "Door" }).click();
  await person.waitForURL("**/door");
  await admin.getByRole("radio", { name: "Member" }).click();
  await expect(admin.getByRole("radio", { name: "Member" })).toBeChecked();
  await lookAgain();
  await person.waitForURL("**/pass");
  await expect(dock.getByRole("link", { name: "Door" })).toHaveCount(0);
  await expect(dock.getByRole("link", { name: "Office" })).toHaveCount(0);
});

test("a link opens in Georgian on a phone that has not chosen a language", async ({ browser }) => {
  // A phone set to English, as most are: its language is not what decides.
  const page = await (await browser.newContext({ locale: "en-US" })).newPage();
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "შესვლა" })).toBeVisible();

  // English is one tap away, and it stays chosen.
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.goto("/join");
  await expect(page.getByRole("heading", { name: "Request access" })).toBeVisible();
});
