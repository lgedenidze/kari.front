// Names the elements that make a page wider than the phone.
//
//   node e2e/find-overflow.mjs /            # path, default /
//   node e2e/find-overflow.mjs /privacy 360
import { chromium } from "@playwright/test";

const path = process.argv[2] ?? "/";
const width = Number(process.argv[3] ?? 375);
const base = process.env.BASE_URL ?? "http://localhost:3000";

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width, height: 760 }, isMobile: true, hasTouch: true })).newPage();
await page.goto(base + path);
await page.waitForTimeout(1500);

const report = await page.evaluate(() => {
  const limit = document.documentElement.clientWidth;
  const culprits = [];
  for (const element of document.querySelectorAll("body *")) {
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.right <= limit + 0.5) continue;
    // Skip anything inside a culprit already listed: the outermost one is the cause.
    if (culprits.some((c) => c.element.contains(element))) continue;
    culprits.push({ element, right: Math.round(box.right), width: Math.round(box.width) });
  }
  return {
    viewport: limit,
    scrollWidth: document.documentElement.scrollWidth,
    culprits: culprits.slice(0, 8).map((c) => ({
      tag: c.element.tagName.toLowerCase(),
      class: String(c.element.getAttribute("class") ?? "").slice(0, 110),
      text: (c.element.textContent ?? "").trim().slice(0, 40),
      right: c.right,
      width: c.width,
    })),
  };
});

console.log(`viewport ${report.viewport}px, page ${report.scrollWidth}px`);
for (const c of report.culprits) console.log(`  <${c.tag}> right=${c.right} width=${c.width}  "${c.text}"\n     ${c.class}`);
if (report.culprits.length === 0) console.log("  nothing reaches past the right edge");
await browser.close();
