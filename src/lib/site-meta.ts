import type { Metadata, Viewport } from "next";
import { fill, getDict } from "@/i18n";
import { venue, type Lang } from "@/venue";

export const viewport: Viewport = {
  themeColor: "#14235e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** Metadata for a public page that exists in both languages at `path` and `/en${path}`. */
export function siteMetadata(lang: Lang, path: "" | "/privacy", pageTitle?: string): Metadata {
  const t = getDict(lang);
  const siteTitle = fill(t.landing.metaTitle, { venue: venue.name, kind: venue.kind[lang], city: venue.city[lang] });
  const title = pageTitle ? `${pageTitle} — ${venue.name}` : siteTitle;
  const ka = path || "/";
  const en = `/en${path}`;

  return {
    metadataBase: new URL(venue.url),
    title,
    description: t.landing.metaDescription,
    applicationName: venue.name,
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: venue.name, statusBarStyle: "black-translucent" },
    alternates: {
      canonical: lang === "en" ? en : ka,
      languages: { ka, en, "x-default": ka },
    },
    openGraph: {
      title,
      description: t.landing.metaDescription,
      url: lang === "en" ? en : ka,
      siteName: venue.name,
      locale: lang === "ka" ? "ka_GE" : "en_GB",
      alternateLocale: lang === "ka" ? "en_GB" : "ka_GE",
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description: t.landing.metaDescription },
  };
}

/** Everything behind the door is personal: keep it out of search engines. */
export const appMetadata: Metadata = {
  metadataBase: new URL(venue.url),
  title: { default: venue.name, template: `%s — ${venue.name}` },
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: venue.name, statusBarStyle: "black-translucent" },
};
