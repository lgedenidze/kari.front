import { getLang } from "@/i18n/server";
import { firstAnswer } from "@/lib/server-api";
import { savedTicketLink, ticketImage } from "@/lib/ticket-image";
import type { InviteLinkResponse } from "@/lib/types";

// An accepted invite as a picture. Until the guest has accepted there is no ticket, and the
// member who sent the invite is never shown the guest's — the API decides both.
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const invite = await firstAnswer<InviteLinkResponse>(`/invites/code/${encodeURIComponent(code)}`);
  if (!invite?.ticket) return new Response(null, { status: 404 });
  const link = savedTicketLink(new URL(request.url).origin, `/i/${encodeURIComponent(code)}`, invite.ticket.shortCode);
  return ticketImage({ ticket: invite.ticket, link, lang: await getLang() });
}
