import { getLang } from "@/i18n/server";
import { googleCardOffer, googleTicketOffer, googleWalletReady } from "@/lib/google-wallet";
import { firstAnswer } from "@/lib/server-api";
import type { MemberCard, TonightResponse } from "@/lib/types";

// What whoever is signed in keeps in an Android phone's Google Wallet: the twin of
// ../wallet.pkpass. A member gets their card, good every night; anyone else who holds a
// ticket tonight gets that ticket. Only where the bar has its key from Google: otherwise
// there is nothing here.
export async function GET() {
  if (!googleWalletReady()) return new Response(null, { status: 404 });
  const lang = await getLang();

  const card = await firstAnswer<MemberCard>("/pass/card");
  if (card) return googleCardOffer({ card, lang });

  const tonight = await firstAnswer<TonightResponse>("/pass/tonight");
  if (!tonight?.ticket) return new Response(null, { status: 404 });
  return googleTicketOffer({ ticket: tonight.ticket, lang, doors: { open: tonight.tonight.doorsOpen, close: tonight.tonight.doorsClose } });
}
