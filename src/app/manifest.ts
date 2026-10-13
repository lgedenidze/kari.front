import type { MetadataRoute } from "next";
import { venue } from "@/venue";

// Lets a member add the pass to their home screen, where it opens full-screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: venue.name,
    short_name: venue.name,
    description: `${venue.name} — ${venue.kind.en}, ${venue.city.en}`,
    start_url: "/pass",
    display: "standalone",
    orientation: "portrait",
    background_color: "#14235e",
    theme_color: "#14235e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
