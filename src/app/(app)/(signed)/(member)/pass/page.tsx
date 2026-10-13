import { getDict } from "@/i18n";
import { getLang } from "@/i18n/server";
import { requireMe } from "@/lib/server-api";
import { PassScreen } from "./pass-screen";

export async function generateMetadata() {
  return { title: getDict(await getLang()).pass.title };
}

export default async function Page() {
  await requireMe("/pass");
  return <PassScreen />;
}
