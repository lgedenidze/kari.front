import { TopBar } from "@/components/app-chrome";
import { firstAnswer } from "@/lib/server-api";
import type { InviteLinkResponse } from "@/lib/types";
import { googleWalletReady } from "@/lib/google-wallet";
import { walletReady } from "@/lib/wallet-pass";
import { InviteScreen } from "./invite-screen";

// Saved to a home screen, this page must reopen as this invite — see lib/web-manifest.ts.
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  return { manifest: `/i/${(await params).code}/manifest.webmanifest` };
}

// The invite link. It works with no account: the guest opens it, answers, and holds a ticket.
// The invite is fetched here, so the page arrives already showing it.
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const first = await firstAnswer<InviteLinkResponse>(`/invites/code/${encodeURIComponent(code)}`);
  return (
    <>
      <TopBar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-5 pb-10 pt-6">
        <InviteScreen code={code} first={first} wallet={walletReady()} google={googleWalletReady()} />
      </main>
    </>
  );
}
