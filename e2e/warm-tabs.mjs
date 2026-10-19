// Measures what a tap on the dock costs, on a real production build.
//
//   node e2e/warm-tabs.mjs                                   # http://localhost:3000 (next start)
//   BASE_URL=https://kari-kappa.vercel.app node e2e/warm-tabs.mjs
//
// The dock fetches every tab ahead, in full — but only in production: `next dev` does not
// prefetch, so this cannot be an ordinary end-to-end test. It signs in, lets the dock fetch,
// then taps every tab and reports, for each: how many requests the tap had to make for the
// page, whether any placeholder was shown, and how long until the screen had its content.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(here, "../../api/src/Kari.Api/appsettings.Development.json"), "utf8")).Kari.Seed;
const base = process.env.BASE_URL ?? "http://localhost:3000";
const slowMs = Number(process.env.SLOW_MS ?? 0);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
await ctx.addCookies([{ name: "kari_lang", value: "ka", url: base }]);
const page = await ctx.newPage();
const login = await page.request.post(`${base}/api/auth/login`, { data: { phone: seed.AdminPhone, password: seed.AdminPassword } });
if (!login.ok()) throw new Error(`sign-in failed: ${login.status()}`);

if (slowMs > 0) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const slow = request.headers()["rsc"] !== undefined || new URL(request.url()).pathname.startsWith("/api/");
    if (slow) await new Promise((resolve) => setTimeout(resolve, slowMs));
    await route.continue();
  });
}

let pageRequests = [];
page.on("request", (request) => {
  if (request.headers()["rsc"] !== undefined) pageRequests.push(new URL(request.url()).pathname);
});

await page.goto(`${base}/pass`);
// Time for the dock to fetch the other tabs ahead.
await page.waitForTimeout(3500 + slowMs * 2);
console.log(`fetched ahead after opening /pass: ${[...new Set(pageRequests)].join(", ") || "nothing"}`);

// What each screen shows once it has its content.
const ARRIVED = {
  "/invites": "h2#for-you",
  "/door": "dl dd",
  "/admin": "main h1.title",
  "/profile": "h1.title",
  "/pass": ".ticket, .paper",
};

let worst = 0;
for (const href of ["/invites", "/door", "/admin", "/profile", "/pass", "/invites", "/admin", "/door"]) {
  pageRequests = [];
  await page.evaluate(() => {
    const seen = { placeholder: false };
    window.seen = seen;
    const look = () => {
      if (window.seen !== seen) return;
      if (document.querySelector("[data-skeleton]")) seen.placeholder = true;
      requestAnimationFrame(look);
    };
    look();
  });
  const started = Date.now();
  await page.locator(`nav.tab-dock a[href="${href}"]`).tap();
  await page.waitForURL(`**${href}`);
  await page.locator(ARRIVED[href]).first().waitFor({ state: "visible" });
  const took = Date.now() - started;
  await page.waitForTimeout(700);
  const placeholder = await page.evaluate(() => window.seen.placeholder);
  const asked = pageRequests.filter((path) => path === href).length;
  worst = Math.max(worst, took);
  console.log(`${href.padEnd(9)} content after ${String(took).padStart(4)} ms   page requests on tap: ${asked}   placeholder shown: ${placeholder ? "YES" : "no"}`);
}

await browser.close();
console.log(`\nslowest tab: ${worst} ms`);
