import { getLang } from "@/i18n/server";
import { googleTicketOffer, googleWalletReady } from "@/lib/google-wallet";
import { firstAnswer } from "@/lib/server-api";
import type { InviteLinkResponse } from "@/lib/types";

// An accepted invite for an Android phone's Google Wallet: the twin of ../wallet.pkpass, under
// the same rules. Until the guest has accepted there is no ticket.
export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  if (!googleWalletReady()) return new Response(null, { status: 404 });
  const { code } = await context.params;
  const invite = await firstAnswer<InviteLinkResponse>(`/invites/code/${encodeURIComponent(code)}`);
  if (!invite?.ticket) return new Response(null, { status: 404 });
  return googleTicketOffer({ ticket: invite.ticket, lang: await getLang(), doors: { open: invite.night.doorsOpen, close: invite.night.doorsClose } });
}
