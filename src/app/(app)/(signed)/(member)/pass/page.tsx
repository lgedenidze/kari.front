import { getDict } from "@/i18n";
import { getLang } from "@/i18n/server";
import { firstAnswer, requireMe } from "@/lib/server-api";
import type { TonightResponse } from "@/lib/types";
import { PassScreen } from "./pass-screen";

export async function generateMetadata() {
  return { title: getDict(await getLang()).pass.title };
}

// The pass is fetched here, together with the sign-in check, so the screen opens holding it.
export default async function Page() {
  const [, first] = await Promise.all([requireMe("/pass"), firstAnswer<TonightResponse>("/pass/tonight")]);
  return <PassScreen first={first} />;
}
