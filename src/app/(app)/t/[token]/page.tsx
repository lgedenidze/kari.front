import { TopBar } from "@/components/app-chrome";
import { TicketScreen } from "./ticket-screen";

// A ticket issued at the door. Staff show the walk-in a QR of this address; whoever opens it
// holds the ticket, with no account.
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <TopBar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-5 pb-10 pt-6">
        <TicketScreen token={token} />
      </main>
    </>
  );
}
