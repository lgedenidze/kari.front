import { TopBar } from "@/components/app-chrome";
import { firstAnswer } from "@/lib/server-api";
import type { TicketResponse } from "@/lib/types";
import { googleWalletReady } from "@/lib/google-wallet";
import { walletReady } from "@/lib/wallet-pass";
import { TicketScreen } from "./ticket-screen";

// Saved to a home screen, this page must reopen as this ticket — see lib/web-manifest.ts.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  return { manifest: `/t/${(await params).token}/manifest.webmanifest` };
}

// A ticket issued at the door. Staff show the walk-in a QR of this address; whoever opens it
// holds the ticket, with no account. It is fetched here, so the page arrives showing it.
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const first = await firstAnswer<TicketResponse>(`/tickets/${encodeURIComponent(token)}`);
  return (
    <>
      <TopBar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-5 pb-10 pt-6">
        <TicketScreen token={token} first={first} wallet={walletReady()} google={googleWalletReady()} />
      </main>
    </>
  );
}
