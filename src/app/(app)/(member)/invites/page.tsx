import { getDict } from "@/i18n";
import { getLang } from "@/i18n/server";
import { requireMe } from "@/lib/server-api";
import { InvitesScreen } from "./invites-screen";

export async function generateMetadata() {
  return { title: getDict(await getLang()).invites.title };
}

export default async function Page() {
  await requireMe("/invites");
  return <InvitesScreen />;
}
