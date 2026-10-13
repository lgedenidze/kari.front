import { venue } from "@/venue";

/**
 * The manifest a phone reads when the site is saved to the home screen.
 *
 * `startUrl` is where the saved icon opens. A member's icon opens their pass. A guest holding
 * an invite or a door ticket has no account, so their icon must open that ticket's own link —
 * which is why each of those pages serves its own manifest rather than sharing one.
 */
export function webManifest(startUrl: string) {
  return {
    name: venue.name,
    short_name: venue.name,
    description: `${venue.name} — ${venue.kind.en}, ${venue.city.en}`,
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#14235e",
    theme_color: "#14235e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

export function manifestResponse(startUrl: string): Response {
  return new Response(JSON.stringify(webManifest(startUrl)), {
    headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
