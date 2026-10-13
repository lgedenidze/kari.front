import { getDict } from "@/i18n";
import { getLang } from "@/i18n/server";
import { firstAnswer, requireMe } from "@/lib/server-api";
import type { Overview } from "@/lib/types";
import { AdminScreen } from "./admin-screen";

export async function generateMetadata() {
  return { title: getDict(await getLang()).admin.title };
}

// The first tab's figures come with the page. The other tabs ask when they are opened.
export default async function Page() {
  const [, first] = await Promise.all([requireMe("/admin", ["admin"]), firstAnswer<Overview>("/admin/overview")]);
  return <AdminScreen first={first} />;
}
