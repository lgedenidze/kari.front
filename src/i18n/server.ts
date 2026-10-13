import "server-only";
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, type Lang } from "@/venue";

/**
 * The language for the signed-in part of the site: the visitor's saved choice, else what their
 * browser asks for, else Georgian. The public pages do not use this — their language is in
 * the URL (/ and /en), so search engines see two stable pages.
 */
export async function getLang(): Promise<Lang> {
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  if (saved === "ka" || saved === "en") return saved;

  const accepted = (await headers()).get("accept-language") ?? "";
  const first = accepted.split(",")[0]?.trim().toLowerCase() ?? "";
  if (first.startsWith("ka")) return "ka";
  return first.startsWith("en") ? "en" : "ka";
}
