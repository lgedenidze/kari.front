import { redirect } from "next/navigation";
import { TopBar } from "@/components/app-chrome";
import { WoxCredit } from "@/components/brand";
import { getDict } from "@/i18n";
import { getLang } from "@/i18n/server";
import { getMe } from "@/lib/server-api";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  return { title: getDict(await getLang()).login.title };
}

/** Only ever send people back to a page on this site. */
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/pass";
}

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getMe()) redirect(next);
  const t = getDict(await getLang());

  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
        <LoginForm next={next} />
        <p className="mt-6 flex justify-center">
          <WoxCredit label={t.common.poweredBy} className="text-paper-light" />
        </p>
      </main>
    </>
  );
}
