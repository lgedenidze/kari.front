import { getDict } from "@/i18n";
import { getLang } from "@/i18n/server";
import { requireMe } from "@/lib/server-api";
import { AdminScreen } from "./admin-screen";

export async function generateMetadata() {
  return { title: getDict(await getLang()).admin.title };
}

export default async function Page() {
  await requireMe("/admin", ["admin"]);
  return <AdminScreen />;
}
