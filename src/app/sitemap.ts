import type { MetadataRoute } from "next";
import { venue } from "@/venue";

// Only the public pages. Each exists in Georgian (/) and English (/en), declared as alternates
// so search engines show the right one.
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/privacy"] as const;
  return pages.map((path) => ({
    url: `${venue.url}${path || "/"}`,
    changeFrequency: path === "" ? "weekly" : "yearly",
    priority: path === "" ? 1 : 0.3,
    alternates: {
      languages: {
        ka: `${venue.url}${path || "/"}`,
        en: `${venue.url}/en${path}`,
      },
    },
  }));
}
