import { getLang } from "@/i18n/server";
import { firstAnswer } from "@/lib/server-api";
import type { TonightResponse } from "@/lib/types";
import { walletPass, walletReady } from "@/lib/wallet-pass";

// Tonight's pass for the iPhone's Wallet. Only for whoever is signed in, and only where the
// bar has its certificate from Apple: otherwise there is nothing here.
export async function GET(request: Request) {
  if (!walletReady()) return new Response(null, { status: 404 });
  const tonight = await firstAnswer<TonightResponse>("/pass/tonight");
  if (!tonight?.ticket) return new Response(null, { status: 404 });
  return walletPass({
    ticket: tonight.ticket,
    live: `${new URL(request.url).origin}/pass`,
    lang: await getLang(),
    doors: { open: tonight.tonight.doorsOpen, close: tonight.tonight.doorsClose },
  });
}
