import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { ticketFonts } from "./ticket-fonts";

// The band across a Wallet pass: the app's own paper ticket, laid on the pass's ink.
//
// Wallet sets every word of a pass in its own typeface and puts a name wherever it likes — over
// anything drawn behind it. So the name is not left to Wallet. It is drawn here, in the app's
// headline cut, on a ticket with the same notches and the same stamp as every ticket in the
// app, and it is measured so that it never runs into the stamp. That makes this picture
// different for every pass, which is why it is drawn when the pass is asked for and is not a
// file like the logo.
//
// Apple gives an event ticket's strip 375 by 98 points; it is drawn at 1x, 2x and 3x.

// The app's own colours (app/globals.css).
const INK = "#14235e"; // the pass's background, to the digit (lib/wallet-ticket.ts)
const PAPER = "#f4d4d7";
const PAPER_SOFT = "#4d5a8f";

const WIDTH = 375;
const HEIGHT = 98;

// The maker's stamp, blue on ticket paper (e2e/wallet-art.mjs draws it). Satori cannot draw a
// stamp's worn edges or its words on a ring, so it comes as a picture.
const stamp = readFile(join(process.cwd(), "assets/wallet/stamp.png")).then((file) => `data:image/png;base64,${file.toString("base64")}`);

/** The size the name is set at, by its longer half, so the longest fits before the stamp. */
function nameSize(first: string, last: string): number {
  const longest = Math.max(first.length, last.length);
  if (longest <= 8) return 27;
  if (longest <= 11) return 25;
  if (longest <= 14) return 22.5;
  if (longest <= 18) return 20;
  return 17;
}

export async function walletStrip({ kind, firstName, lastName }: { kind: string; firstName: string; lastName: string }): Promise<Record<string, Buffer>> {
  const seal = await stamp;
  const size = nameSize(firstName, lastName);

  const draw = async (scale: number): Promise<Buffer> => {
    const u = (points: number) => points * scale;
    const picture = new ImageResponse(
      (
        <div style={{ width: u(WIDTH), height: u(HEIGHT), display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: INK }}>
          {/* the ticket */}
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              width: u(351),
              height: u(90),
              borderRadius: u(16),
              backgroundColor: PAPER,
              color: INK,
              fontFamily: "Text",
            }}
          >
            {/* the two notches every ticket in the app has, cut out of the paper */}
            <div style={{ position: "absolute", left: u(-9), top: u(36), width: u(18), height: u(18), borderRadius: u(9), backgroundColor: INK }} />
            <div style={{ position: "absolute", right: u(-9), top: u(36), width: u(18), height: u(18), borderRadius: u(9), backgroundColor: INK }} />

            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, height: u(90), paddingLeft: u(20), overflow: "hidden" }}>
              <div style={{ display: "flex", fontWeight: 700, fontSize: u(10.5), color: PAPER_SOFT, whiteSpace: "nowrap" }}>{kind}</div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginTop: u(1),
                  fontFamily: "Display",
                  fontSize: u(size),
                  // Tall enough for Georgian tails (ვ, ფ, პ) between the two lines.
                  lineHeight: 1.1,
                  whiteSpace: "nowrap",
                }}
              >
                <div style={{ display: "flex" }}>{firstName}</div>
                <div style={{ display: "flex" }}>{lastName}</div>
              </div>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element -- a picture inside a picture: there is no page here */}
            <img src={seal} width={u(78)} height={u(78)} alt="" style={{ marginLeft: u(8), marginRight: u(16) }} />
          </div>
        </div>
      ),
      { width: u(WIDTH), height: u(HEIGHT), fonts: ticketFonts },
    );
    return Buffer.from(await picture.arrayBuffer());
  };

  const [one, two, three] = await Promise.all([draw(1), draw(2), draw(3)]);
  return { "strip.png": one, "strip@2x.png": two, "strip@3x.png": three };
}
