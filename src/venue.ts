/**
 * The bar's identity. Its name is the app's name: KARI (კარი, "door"), on the owner's word
 * (2026-10-13). It was NISLI while the name was not known. Rename the venue here, and in the
 * invite SMS the API sends (kari.back: Features/Invites/InviteSms.cs).
 */
export const venue = {
  name: "KARI",
  nameKa: "კარი",
  /** Shown beside the name in metadata and the stamp ring. */
  kind: { ka: "ბარი", en: "Bar" },
  city: { ka: "თბილისი", en: "Tbilisi" },
  address: { ka: "თბილისი, საქართველო", en: "Tbilisi, Georgia" },
  /** Public site URL, used for canonical links, the sitemap and invite links. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** On the owner's word, 2026-10-15: "make age to 21". It was 18. */
  minimumAge: 21,
  /** The agency credit. Small on purpose: the bar's name is the loud one. */
  poweredBy: { label: "wox.ge", href: "https://wox.ge" },
} as const;

export type Lang = "ka" | "en";
export const LANGS: readonly Lang[] = ["ka", "en"];
export const LANG_COOKIE = "kari_lang";
