import "server-only";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { fill, formatNight, getDict } from "@/i18n";
import { venue, type Lang } from "@/venue";
import { ticketFonts } from "./ticket-fonts";
import type { Ticket } from "./types";

// A ticket as a picture, for the "download" button: something to keep in Photos, send to a
// friend, or print.
//
// It is drawn here, on the server, so it is the same picture on every phone — and so it can
// be fetched like any other file. It is a 1080×1920 portrait, the shape a phone shows whole.
//
// What its QR is, and is not: the code on a live pass changes every thirty seconds, so a
// picture can never carry it — and must not carry the key that makes it. The QR here is the
// ticket's own address. Any camera that reads it opens the live ticket; the door's scanner
// reads it too, and looks the guest up by the short code (lib/saved-ticket.ts).

// The app's own colours (app/globals.css). A picture cannot read CSS variables.
const INK = "#14235e";
const INK_DEEP = "#0c1740";
const INK_SOFT = "#a9b6e6";
const PAPER = "#f4d4d7";
const PAPER_LIGHT = "#fbecee";
const PAPER_LINE = "#dfaab1";
const PAPER_SOFT = "#4d5a8f";
const QR_WHITE = "#fffafa";
const WOX_DOT = "#7b5fcb";

const WIDTH = 1080;
const HEIGHT = 1920;

export { savedTicketLink } from "./saved-ticket";

function qrPath(value: string): { d: string; size: number } {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
  let d = "";
  for (let y = 0; y < modules.size; y += 1) {
    for (let x = 0; x < modules.size; x += 1) {
      if (modules.data[y * modules.size + x]) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { d, size: modules.size };
}

/** A long name is set smaller, so it never runs off the paper. */
function nameSize(ticket: Ticket): number {
  const longest = Math.max(ticket.firstName.length, ticket.lastName.length);
  if (longest > 16) return 72;
  if (longest > 12) return 90;
  return 112;
}

export function ticketImage({ ticket, link, lang }: { ticket: Ticket; link: string; lang: Lang }): ImageResponse {
  const t = getDict(lang);
  const qr = qrPath(link);
  const night = ticket.nightTitle ? `${ticket.nightTitle}, ${formatNight(ticket.night, lang)}` : formatNight(ticket.night, lang, "long");
  const kind =
    ticket.kind === "guest" && ticket.inviterName
      ? fill(t.ticket.guestOf, { name: ticket.inviterName })
      : ticket.kind === "door"
        ? t.ticket.doorTicket
        : ticket.kind === "guest"
          ? t.status.guest
          : t.ticket.member;
  const size = nameSize(ticket);

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          backgroundColor: INK,
          fontFamily: "Text",
          color: INK,
        }}
      >
        {/* the bar's name, as on every screen of the app */}
        <div style={{ display: "flex", alignItems: "baseline", width: 900, marginTop: 70 }}>
          <div style={{ fontFamily: "Display", fontSize: 92, letterSpacing: 4, color: PAPER_LIGHT }}>{venue.name}</div>
          <div style={{ fontFamily: "Text", fontWeight: 700, fontSize: 40, color: PAPER_LIGHT, opacity: 0.8, marginLeft: 22 }}>{venue.nameKa}</div>
        </div>

        {/* the paper ticket */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 900,
            marginTop: 36,
            backgroundColor: PAPER,
            borderRadius: 56,
            position: "relative",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", padding: "52px 64px 36px" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", fontWeight: 700, fontSize: 36 }}>{night}</div>

            <div style={{ display: "flex", flexDirection: "column", marginTop: 14, fontFamily: "Display", fontSize: size, lineHeight: 1.02 }}>
              <div>{ticket.firstName}</div>
              <div>{ticket.lastName}</div>
            </div>
            <div style={{ display: "flex", marginTop: 16, fontWeight: 700, fontSize: 34, color: PAPER_SOFT }}>{kind}</div>

            {/* the window: a QR of this ticket's own address */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 36,
                padding: 44,
                backgroundColor: QR_WHITE,
                borderRadius: 44,
              }}
            >
              <svg width={540} height={540} viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges">
                <path d={qr.d} fill={INK_DEEP} />
              </svg>
            </div>

            <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
              <div style={{ fontWeight: 700, fontSize: 36 }}>{t.ticket.imageCaption}</div>
              <div style={{ marginTop: 8, fontSize: 31, color: PAPER_SOFT }}>{t.ticket.imageHint}</div>
            </div>
          </div>

          {/* the tear line, with the two notches every ticket in the app has */}
          <div style={{ display: "flex", alignItems: "center", height: 56, position: "relative" }}>
            <div style={{ position: "absolute", left: -28, top: 0, width: 56, height: 56, borderRadius: 28, backgroundColor: INK }} />
            <div style={{ position: "absolute", right: -28, top: 0, width: 56, height: 56, borderRadius: 28, backgroundColor: INK }} />
            <div style={{ flex: 1, margin: "0 64px", borderTop: `6px dashed ${PAPER_LINE}` }} />
          </div>

          {/* the stub: the code the door can type in, and who made this */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "20px 64px 44px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontWeight: 700, fontSize: 30, color: PAPER_SOFT }}>{t.ticket.code}</div>
              <div style={{ fontWeight: 700, fontSize: 84, letterSpacing: 10, lineHeight: 1.1 }}>{ticket.shortCode}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", fontSize: 30, fontWeight: 700, paddingBottom: 18 }}>
              <svg width={38} height={38} viewBox="0 0 512 512">
                <path d="M 405.22 309.43 A 158.50 158.50 0 1 1 405.22 202.57" fill="none" stroke={INK} strokeWidth={63} strokeLinecap="round" />
                <circle cx={256} cy={256} r={61} fill={WOX_DOT} />
              </svg>
              <div style={{ display: "flex", marginLeft: 14 }}>
                {t.common.poweredBy} {venue.poweredBy.label}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", marginTop: 40, fontSize: 30, color: INK_SOFT }}>
          {venue.kind[lang]}, {venue.city[lang]}
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: ticketFonts,
      headers: {
        // One person's ticket: never a shared cache's business.
        "Cache-Control": "private, max-age=60",
        "Content-Disposition": `attachment; filename="${venue.name.toLowerCase()}-${ticket.shortCode}.png"`,
      },
    },
  );
}
