import { TopBar } from "@/components/app-chrome";
import { InviteScreen } from "./invite-screen";

// Saved to a home screen, this page must reopen as this invite — see lib/web-manifest.ts.
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  return { manifest: `/i/${(await params).code}/manifest.webmanifest` };
}

// The invite link. It works with no account: the guest opens it, answers, and holds a ticket.
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <>
      <TopBar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-5 pb-10 pt-6">
        <InviteScreen code={code} />
      </main>
    </>
  );
}
