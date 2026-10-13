import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The typeface for every picture the server draws: the downloaded ticket (ticket-image.tsx)
// and the band on a Wallet pass (wallet-strip.tsx).
//
// Satori, which draws them, needs static fonts: no variable axes, no WOFF2. These three are
// the same family the app uses, cut at fixed weights (assets/fonts, SIL Open Font License).
// Each path is written out in full on purpose: the build follows these to know which files
// must ship with a function (next.config.ts names the folder as well).
const [condensed, regular, bold] = await Promise.all([
  readFile(join(process.cwd(), "assets/fonts/NotoSansGeorgian-CondensedExtraBold.ttf")),
  readFile(join(process.cwd(), "assets/fonts/NotoSansGeorgian-Regular.ttf")),
  readFile(join(process.cwd(), "assets/fonts/NotoSansGeorgian-Bold.ttf")),
]);

/** "Display" is the condensed headline cut; "Text" the regular and the bold. */
export const ticketFonts = [
  { name: "Display", data: condensed, weight: 800 as const, style: "normal" as const },
  { name: "Text", data: regular, weight: 400 as const, style: "normal" as const },
  { name: "Text", data: bold, weight: 700 as const, style: "normal" as const },
];
