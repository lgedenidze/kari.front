import { getLang } from "@/i18n/server";
import { savedTicketLink } from "@/lib/saved-ticket";
import { firstAnswer } from "@/lib/server-api";
import type { InviteLinkResponse } from "@/lib/types";
import { walletPass, walletReady } from "@/lib/wallet-pass";

// An accepted invite for the iPhone's Wallet. Until the guest has accepted there is no
// ticket, and the member who sent the invite is never given the guest's: the API decides both.
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  if (!walletReady()) return new Response(null, { status: 404 });
  const { code } = await context.params;
  const invite = await firstAnswer<InviteLinkResponse>(`/invites/code/${encodeURIComponent(code)}`);
  if (!invite?.ticket) return new Response(null, { status: 404 });
  const link = savedTicketLink(new URL(request.url).origin, `/i/${encodeURIComponent(code)}`, invite.ticket.shortCode);
  return walletPass({ ticket: invite.ticket, link, lang: await getLang() });
}
