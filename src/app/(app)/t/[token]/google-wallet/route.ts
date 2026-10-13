import { getLang } from "@/i18n/server";
import { googleTicketOffer, googleWalletReady } from "@/lib/google-wallet";
import { firstAnswer } from "@/lib/server-api";
import type { TicketResponse } from "@/lib/types";

// A ticket issued at the door, for an Android phone's Google Wallet: the twin of ../wallet.pkpass.
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  if (!googleWalletReady()) return new Response(null, { status: 404 });
  const { token } = await context.params;
  const found = await firstAnswer<TicketResponse>(`/tickets/${encodeURIComponent(token)}`);
  if (!found) return new Response(null, { status: 404 });
  // Issued to someone already at the door: the hour it runs out is what matters, not when the doors open.
  return googleTicketOffer({ ticket: found.ticket, lang: await getLang() });
}
