import { redirect } from "next/navigation";
import { TopBar } from "@/components/app-chrome";
import { WoxCredit } from "@/components/brand";
import { getDict } from "@/i18n";
import { getLang } from "@/i18n/server";
import { getMe } from "@/lib/server-api";
import { JoinForm } from "./join-form";

export async function generateMetadata() {
  return { title: getDict(await getLang()).join.title };
}

export default async function Page() {
  if (await getMe()) redirect("/pass");
  const t = getDict(await getLang());

  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-lg flex-1 px-5 py-8">
        <JoinForm />
        <p className="mt-6 flex justify-center">
          <WoxCredit label={t.common.poweredBy} className="text-paper-light" />
        </p>
      </main>
    </>
  );
}
