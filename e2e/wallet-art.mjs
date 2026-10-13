// Draws the pictures an Apple Wallet pass carries, into assets/wallet/. Wallet sets every word
// of a pass in its own typeface; pictures are the only way the app's look gets onto it.
//
//   icon   the app's mark (src/app/icon.svg), for notifications and the lock screen
//   logo   the wordmark at the top left of the pass, for the pass's ink ground: the little
//          paper ticket, KARI in the headline cut, კარი
//   stamp  the maker's round stamp, blue on ticket paper. It goes on the band across the pass,
//          which is drawn for each pass by src/lib/wallet-strip.tsx; that drawing cannot make
//          a stamp's worn edges or set words on a ring, so the stamp is made here.
//
// The sizes are Apple's (points): icon 29x29, logo at most 160x50. Run it again when the
// mark, the name or the stamp changes:   node e2e/wallet-art.mjs
//
// And one picture for Google Wallet, into public/wallet/, because Google does not take a
// picture inside a pass: it fetches it from the site.
//
//   google-logo   the app's mark on its ink, 660 by 660 as Google asks. Google cuts it to
//                 a circle, so the ink runs to the edges and the ticket keeps to the middle.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(web, "assets/wallet");
const site = join(web, "public/wallet");
const mark = readFileSync(join(web, "src/app/icon.svg"), "utf8");
const font = (file) => readFileSync(join(web, "assets/fonts", file)).toString("base64");

// The venue's name is read from the one place it is written (src/venue.ts).
const venueSource = readFileSync(join(web, "src/venue.ts"), "utf8");
const name = /name: "([^"]+)"/.exec(venueSource)[1];
const nameKa = /nameKa: "([^"]+)"/.exec(venueSource)[1];
const maker = /label: "([^"]+)"/.exec(venueSource)[1].toUpperCase();

// The app's own colours (src/app/globals.css).
const INK = "#14235e";
const PAPER = "rgb(244, 212, 215)"; // the ticket on the band (src/lib/wallet-strip.tsx)
const PAPER_LIGHT = "#fbecee";
const STAMP_BLUE = "#2447d8";

const base = `
  @font-face { font-family: Display; font-weight: 800; src: url(data:font/ttf;base64,${font("NotoSansGeorgian-CondensedExtraBold.ttf")}); }
  @font-face { font-family: Text; font-weight: 700; src: url(data:font/ttf;base64,${font("NotoSansGeorgian-Bold.ttf")}); }
  html, body { margin: 0; background: transparent; }
`;

// The mark without its ink square: on a pass that is ink already, the paper ticket alone.
const ticket = mark.replace(/<rect width="64" height="64"[^>]*\/>/, "").replace('viewBox="0 0 64 64"', 'viewBox="13 7 38 50"');

// The round door stamp, as components/stamp.tsx draws it — worn edges, dry specks — saying who
// made the system. It is the "WOX.GE" seal from the landing page, in the stamp pad's blue.
const stamp = (size) => `
  <svg viewBox="0 0 200 200" width="${size}" height="${size}" style="display:block;transform:rotate(-9deg);opacity:.92;mix-blend-mode:multiply;color:${STAMP_BLUE}">
    <defs>
      <path id="ring" d="M100,100 m-79,0 a79,79 0 1,1 158,0 a79,79 0 1,1 -158,0" />
      <filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="wobble" />
        <feDisplacementMap in="SourceGraphic" in2="wobble" scale="2.2" result="worn" />
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="3" result="grain" />
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.55" result="specks" />
        <feComposite in="worn" in2="specks" operator="in" />
      </filter>
      <mask id="rings">
        <rect width="200" height="200" fill="white" />
        <rect x="10" y="72" width="180" height="56" fill="black" />
      </mask>
    </defs>
    <g filter="url(#ink)" fill="none" stroke="currentColor" font-family="Display" font-weight="800">
      <g mask="url(#rings)">
        <circle cx="100" cy="100" r="95" stroke-width="6" />
        <circle cx="100" cy="100" r="63" stroke-width="3" />
        <!-- The ring starts at nine o'clock and runs clockwise: a quarter of the way round is
             the top, three quarters the bottom. Each line is centred there, clear of the band. -->
        <text fill="currentColor" stroke="none" font-size="15.5" text-anchor="middle" letter-spacing="0.09em">
          <textPath href="#ring" startOffset="25%">POWERED BY</textPath>
          <textPath href="#ring" startOffset="75%">DOOR SYSTEM</textPath>
        </text>
      </g>
      <rect x="14" y="76" width="172" height="48" rx="6" stroke-width="4" />
      <text x="100" y="110" text-anchor="middle" fill="currentColor" stroke="none" font-size="29" letter-spacing="0.06em">${maker}</text>
    </g>
  </svg>`;

const pictures = [
  {
    name: "icon",
    scales: [1, 2, 3],
    width: 29,
    height: 29,
    html: `<style>${base} svg { display: block; width: 29px; height: 29px; }</style>${mark}`,
  },
  {
    // Sized to its content, and no wider than Apple's 160 points. Clear behind: it lies on the pass's ink.
    name: "logo",
    scales: [1, 2, 3],
    height: 50,
    html: `<style>${base}
        .logo { display: inline-flex; align-items: center; height: 50px; color: ${PAPER_LIGHT}; white-space: nowrap; }
        .logo svg { display: block; width: 28px; height: 37px; margin-right: 10px; }
        .latin { font: 800 33px/1 Display; letter-spacing: 0.04em; }
        .georgian { font: 700 13.5px/1 Text; margin-left: 8px; opacity: 0.8; position: relative; top: 5px; }
      </style>
      <span class="logo" id="art">${ticket}<span class="latin">${name}</span><span class="georgian">${nameKa}</span></span>`,
  },
  {
    // Whole, with its ground: Google lays it on nothing of ours, and cuts it round.
    name: "google-logo",
    folder: site,
    scales: [1],
    width: 660,
    height: 660,
    html: `<style>${base}
        .ground { display: grid; place-items: center; width: 660px; height: 660px; background: ${INK}; }
        .ground svg { display: block; width: 258px; height: 340px; }
      </style>
      <div class="ground">${ticket}</div>`,
  },
  {
    // On the ticket's own paper, so it lies on the band without an edge. One size: the band is
    // drawn at three, and scales this.
    name: "stamp",
    scales: [3],
    width: 84,
    height: 84,
    html: `<style>${base} .on-paper { width: 84px; height: 84px; background: ${PAPER}; }</style><div class="on-paper">${stamp(84)}</div>`,
  },
];

// One colour space for every picture: the stamp's paper has to meet the band's paper without
// a seam.
const browser = await chromium.launch({ args: ["--force-color-profile=srgb"] });
for (const picture of pictures) {
  for (const scale of picture.scales) {
    const page = await browser.newPage({ viewport: { width: picture.width ?? 400, height: picture.height }, deviceScaleFactor: scale });
    await page.setContent(picture.html);
    await page.evaluate(() => document.fonts.ready);
    const file = `${picture.name}${picture.scales.length === 1 || scale === 1 ? "" : `@${scale}x`}.png`;
    const art = page.locator("#art");
    if (await art.count()) {
      const box = await art.boundingBox();
      if (box.width > 160) throw new Error(`${picture.name} is ${box.width} points wide; Apple allows 160`);
      await art.screenshot({ path: join(picture.folder ?? out, file), omitBackground: true });
      console.log(`${file}  ${Math.round(box.width)}x${Math.round(box.height)} pt`);
    } else {
      await page.screenshot({ path: join(picture.folder ?? out, file), omitBackground: true });
      console.log(`${file}  ${picture.width}x${picture.height} pt`);
    }
    await page.close();
  }
}

// The stamp's paper, read back from the file: it must be the band's paper to the digit.
const check = await browser.newPage();
const paper = await check.evaluate(async (data) => {
  const image = new Image();
  image.src = `data:image/png;base64,${data}`;
  await image.decode();
  const canvas = new OffscreenCanvas(image.width, image.height);
  const context = canvas.getContext("2d", { colorSpace: "srgb" });
  context.drawImage(image, 0, 0);
  return [...context.getImageData(2, 2, 1, 1).data].slice(0, 3).join(", ");
}, readFileSync(join(out, "stamp.png")).toString("base64"));
await browser.close();
console.log(`stamp paper: rgb(${paper})`);
if (`rgb(${paper})` !== PAPER) throw new Error(`the stamp's paper is rgb(${paper}), the band's is ${PAPER}`);
