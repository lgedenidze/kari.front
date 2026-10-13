// Draws the home-screen icons from one SVG. Run again after changing the mark:
//
//   node scripts/make-icons.mjs
//
// Phones crop these themselves — iOS rounds the corners, Android may cut a circle — so the
// ink runs to every edge and the ticket keeps to the middle 60%, inside any crop.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%">
  <rect width="64" height="64" fill="#14235e"/>
  <g transform="translate(32 32) scale(0.82) translate(-32 -32)">
    <rect x="17" y="9" width="30" height="46" rx="6" fill="#f4d4d7"/>
    <circle cx="17" cy="41" r="3.4" fill="#14235e"/>
    <circle cx="47" cy="41" r="3.4" fill="#14235e"/>
    <path d="M23 41h18" stroke="#dfaab1" stroke-width="1.6" stroke-dasharray="1.6 2.4" stroke-linecap="round"/>
    <rect x="23" y="16" width="18" height="18" rx="2.5" fill="#14235e"/>
    <rect x="27" y="20" width="10" height="10" rx="1" fill="#f4d4d7"/>
    <rect x="30" y="23" width="4" height="4" fill="#14235e"/>
  </g>
</svg>`;

const targets = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["src/app/apple-icon.png", 180], // Next links this as the apple-touch-icon
];

mkdirSync(join(root, "public/icons"), { recursive: true });
const browser = await chromium.launch();
for (const [file, size] of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  await page.screenshot({ path: join(root, file) });
  await page.close();
  console.log(`${file}  ${size}×${size}`);
}
await browser.close();
