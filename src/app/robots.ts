import type { MetadataRoute } from "next";
import { venue } from "@/venue";

// The landing and privacy pages are for everyone. Everything else is a guest's own pass,
// invite or account, or the staff's tools — none of it belongs in a search index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/en", "/privacy", "/en/privacy"],
      disallow: ["/api/", "/pass", "/invites", "/profile", "/door", "/admin", "/i/", "/t/", "/join", "/login"],
    },
    sitemap: `${venue.url}/sitemap.xml`,
  };
}
