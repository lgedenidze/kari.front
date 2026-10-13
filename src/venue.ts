/**
 * The bar's identity. The real name was not known when this was built — NISLI (ნისლი, "fog")
 * is a working name. Rename the venue here and nowhere else.
 */
export const venue = {
  name: "NISLI",
  nameKa: "ნისლი",
  /** Shown beside the name in metadata and the stamp ring. */
  kind: { ka: "ბარი", en: "Bar" },
  city: { ka: "თბილისი", en: "Tbilisi" },
  address: { ka: "თბილისი, საქართველო", en: "Tbilisi, Georgia" },
  /** Public site URL, used for canonical links, the sitemap and invite links. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  minimumAge: 18,
  /** The agency credit. Small on purpose: the bar's name is the loud one. */
  poweredBy: { label: "wox.ge", href: "https://wox.ge" },
} as const;

export type Lang = "ka" | "en";
export const LANGS: readonly Lang[] = ["ka", "en"];
export const LANG_COOKIE = "kari_lang";
