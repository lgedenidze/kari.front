import { getDict } from "@/i18n";
import { getLang } from "@/i18n/server";
import { firstAnswer, requireMe } from "@/lib/server-api";
import type { InvitesOverview } from "@/lib/types";
import { InvitesScreen } from "./invites-screen";

export async function generateMetadata() {
  return { title: getDict(await getLang()).invites.title };
}

export default async function Page() {
  const [, first] = await Promise.all([requireMe("/invites"), firstAnswer<InvitesOverview>("/invites")]);
  return <InvitesScreen first={first} />;
}
