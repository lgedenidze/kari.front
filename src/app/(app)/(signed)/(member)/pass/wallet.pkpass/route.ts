import { getLang } from "@/i18n/server";
import { savedTicketLink } from "@/lib/saved-ticket";
import { firstAnswer } from "@/lib/server-api";
import type { TonightResponse } from "@/lib/types";
import { walletPass, walletReady } from "@/lib/wallet-pass";

// Tonight's pass for the iPhone's Wallet. Only for whoever is signed in, and only where the
// bar has its certificate from Apple: otherwise there is nothing here.
export async function GET(request: Request) {
  if (!walletReady()) return new Response(null, { status: 404 });
  const tonight = await firstAnswer<TonightResponse>("/pass/tonight");
  if (!tonight?.ticket) return new Response(null, { status: 404 });
  const link = savedTicketLink(new URL(request.url).origin, "/pass", tonight.ticket.shortCode);
  return walletPass({ ticket: tonight.ticket, link, lang: await getLang() });
}
