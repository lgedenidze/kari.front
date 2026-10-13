// Photographs each screen while it is still waiting, and again once it has arrived, so the
// placeholder can be judged against the thing it stands in for.
//
//   node e2e/loading-shots.mjs            # into test-results/loading/
//
// Needs the web app on :3000 and the API on :5080 against the throwaway database.
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(here, "../../api/src/Kari.Api/appsettings.json"), "utf8")).Kari.Seed;
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = join(here, "../test-results/loading");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addCookies([{ name: "kari_lang", value: "ka", url: base }]);
const page = await ctx.newPage();
const login = await page.request.post(`${base}/api/auth/login`, { data: { phone: seed.AdminPhone, password: seed.AdminPassword } });
if (!login.ok()) throw new Error(`sign-in failed: ${login.status()}`);

await page.goto(`${base}/profile`);
await page.waitForTimeout(1200);

// Hold every answer back, so the waiting state stays on screen long enough to photograph.
await page.route("**/*", async (route) => {
  const request = route.request();
  const slow = request.headers()["rsc"] !== undefined || new URL(request.url()).pathname.startsWith("/api/");
  if (slow) await new Promise((resolve) => setTimeout(resolve, 2500));
  await route.continue();
});

for (const href of ["/pass", "/invites", "/door", "/admin"]) {
  // Not a pointer click: in development the Next.js badge sits over the first tab.
  await page.locator(`nav.tab-dock a[href="${href}"]`).dispatchEvent("click");
  await page.waitForTimeout(900);
  const name = href.slice(1);
  await page.screenshot({ path: join(out, `${name}-1-waiting.png`) });
  const waiting = await page.evaluate(() => {
    const el = document.querySelector("[data-skeleton]");
    return el ? { shape: el.getAttribute("data-skeleton"), height: Math.round(el.getBoundingClientRect().height) } : null;
  });
  await page.waitForTimeout(6500);
  await page.screenshot({ path: join(out, `${name}-2-arrived.png`) });
  const arrived = await page.evaluate(() => {
    const el = document.querySelector(".ticket");
    return el ? Math.round(el.getBoundingClientRect().height) : null;
  });
  console.log(name, "waiting:", JSON.stringify(waiting), "ticket height once arrived:", arrived);
}

await browser.close();
console.log(`\nSaved to ${out}`);
