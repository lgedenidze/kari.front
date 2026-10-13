// Draws the pictures an Apple Wallet pass must carry — its icon and its logo — from the app's
// own mark (src/app/icon.svg), into assets/wallet/. Run it again only when that mark changes:
//   node e2e/wallet-icons.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const mark = readFileSync(join(web, "src/app/icon.svg"), "utf8");

// Points, as Wallet counts them; each is drawn at 1x, 2x and 3x.
const pictures = [
  ["icon", 29],
  ["logo", 50],
];

const browser = await chromium.launch();
for (const [name, points] of pictures) {
  for (const scale of [1, 2, 3]) {
    const page = await browser.newPage({ viewport: { width: points, height: points }, deviceScaleFactor: scale });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${points}px;height:${points}px}</style>${mark}`);
    const file = `${name}${scale === 1 ? "" : `@${scale}x`}.png`;
    // The corners outside the mark's rounded square stay clear.
    await page.screenshot({ path: join(web, "assets/wallet", file), omitBackground: true });
    await page.close();
    console.log(file);
  }
}
await browser.close();
