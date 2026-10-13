import { getDict } from "@/i18n";
import { getLang } from "@/i18n/server";
import { requireMe } from "@/lib/server-api";
import { ProfileScreen } from "./profile-screen";

export async function generateMetadata() {
  return { title: getDict(await getLang()).profile.title };
}

export default async function Page() {
  await requireMe("/profile");
  return <ProfileScreen />;
}
