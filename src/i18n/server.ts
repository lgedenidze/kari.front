import "server-only";
import { cookies } from "next/headers";
import { LANG_COOKIE, type Lang } from "@/venue";

/**
 * The language for everything that is not a public page: the visitor's own choice, and
 * Georgian for everyone who has not made one. The phone's language is not asked. Most phones
 * in Tbilisi are set to English, and an invite link — the first page a guest ever opens here,
 * with no choice saved yet — then opened in English for a Georgian guest. English is one tap
 * away in the top bar. The public pages do not use this — their language is in the URL
 * (/ and /en), so search engines see two stable pages.
 */
export async function getLang(): Promise<Lang> {
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  return saved === "en" ? "en" : "ka";
}
