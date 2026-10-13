import { getLang } from "@/i18n/server";
import { firstAnswer } from "@/lib/server-api";
import { savedTicketLink, ticketImage } from "@/lib/ticket-image";
import type { TicketResponse } from "@/lib/types";

// A ticket issued at the door, as a picture.
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const found = await firstAnswer<TicketResponse>(`/tickets/${encodeURIComponent(token)}`);
  if (!found) return new Response(null, { status: 404 });
  const link = savedTicketLink(new URL(request.url).origin, `/t/${encodeURIComponent(token)}`, found.ticket.shortCode);
  return ticketImage({ ticket: found.ticket, link, lang: await getLang() });
}
