import { getLang } from "@/i18n/server";
import { firstAnswer } from "@/lib/server-api";
import { savedTicketLink, ticketImage } from "@/lib/ticket-image";
import type { TonightResponse } from "@/lib/types";

// Tonight's pass as a picture, for the download button. Only for whoever is signed in: with
// no session, or no pass tonight, there is nothing to draw.
export async function GET(request: Request) {
  const tonight = await firstAnswer<TonightResponse>("/pass/tonight");
  if (!tonight?.ticket) return new Response(null, { status: 404 });
  const link = savedTicketLink(new URL(request.url).origin, "/pass", tonight.ticket.shortCode);
  return ticketImage({ ticket: tonight.ticket, link, lang: await getLang() });
}
