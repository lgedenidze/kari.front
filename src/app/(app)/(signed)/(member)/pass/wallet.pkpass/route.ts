import { getLang } from "@/i18n/server";
import { firstAnswer } from "@/lib/server-api";
import type { MemberCard, TonightResponse } from "@/lib/types";
import { walletCardPass, walletPass, walletReady } from "@/lib/wallet-pass";

// What whoever is signed in keeps in their iPhone's Wallet. Only where the bar has its
// certificate from Apple: otherwise there is nothing here.
//
// A member gets their card: added once, good every night, with or without a pass for
// tonight. Anyone else who holds a ticket tonight — a guest still in review, say — gets that
// ticket, for that night.
export async function GET(request: Request) {
  if (!walletReady()) return new Response(null, { status: 404 });
  const live = `${new URL(request.url).origin}/pass`;
  const lang = await getLang();

  const card = await firstAnswer<MemberCard>("/pass/card");
  if (card) return walletCardPass({ card, live, lang });

  const tonight = await firstAnswer<TonightResponse>("/pass/tonight");
  if (!tonight?.ticket) return new Response(null, { status: 404 });
  return walletPass({
    ticket: tonight.ticket,
    live,
    lang,
    doors: { open: tonight.tonight.doorsOpen, close: tonight.tonight.doorsClose },
  });
}
