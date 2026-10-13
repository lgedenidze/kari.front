import { getDict } from "@/i18n";
import { getLang } from "@/i18n/server";
import { firstAnswer, requireMe } from "@/lib/server-api";
import type { DoorTonight } from "@/lib/types";
import { DoorScreen } from "./door-screen";

export async function generateMetadata() {
  return { title: getDict(await getLang()).door.title };
}

export default async function Page() {
  const [, first] = await Promise.all([requireMe("/door", ["staff", "admin"]), firstAnswer<DoorTonight>("/door/tonight")]);
  return <DoorScreen first={first} />;
}
