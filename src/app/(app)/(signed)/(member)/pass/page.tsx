import { getDict } from "@/i18n";
import { getLang } from "@/i18n/server";
import { googleWalletReady } from "@/lib/google-wallet";
import { firstAnswer, getVenue, requireMe } from "@/lib/server-api";
import type { TonightResponse } from "@/lib/types";
import { walletReady } from "@/lib/wallet-pass";
import { PassScreen } from "./pass-screen";

export async function generateMetadata() {
  return { title: getDict(await getLang()).pass.title };
}

// The pass is fetched here, together with the sign-in check, so the screen opens holding it.
export default async function Page() {
  // The coming week comes too (it is the landing page's own copy, a minute old at most):
  // on a closed night the pass says when the next open one is.
  const [, first, venue] = await Promise.all([requireMe("/pass"), firstAnswer<TonightResponse>("/pass/tonight"), getVenue()]);
  return <PassScreen first={first} week={venue?.week ?? null} wallet={walletReady()} google={googleWalletReady()} />;
}
