import { getLang } from "@/i18n/server";
import { firstAnswer } from "@/lib/server-api";
import type { TicketResponse } from "@/lib/types";
import { walletPass, walletReady } from "@/lib/wallet-pass";

// A ticket issued at the door, for the iPhone's Wallet.
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  if (!walletReady()) return new Response(null, { status: 404 });
  const { token } = await context.params;
  const found = await firstAnswer<TicketResponse>(`/tickets/${encodeURIComponent(token)}`);
  if (!found) return new Response(null, { status: 404 });
  // Issued to someone already at the door: the hour it runs out is what matters, not when the doors open.
  return walletPass({ ticket: found.ticket, live: `${new URL(request.url).origin}/t/${encodeURIComponent(token)}`, lang: await getLang() });
}
