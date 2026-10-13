import { MeProvider } from "@/components/me";
import { getDict } from "@/i18n";
import { getLang } from "@/i18n/server";
import { requireMe } from "@/lib/server-api";
import { DoorScreen } from "./door-screen";

export async function generateMetadata() {
  return { title: getDict(await getLang()).door.title };
}

export default async function Page() {
  const me = await requireMe("/door", ["staff", "admin"]);
  return (
    <MeProvider initial={me}>
      <DoorScreen />
    </MeProvider>
  );
}
