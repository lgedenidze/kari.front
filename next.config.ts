import type { NextConfig } from "next";

// The site's public address, used for canonical links, the sitemap and invite links. Set
// NEXT_PUBLIC_SITE_URL once the bar has its own domain; until then a Vercel deployment uses
// the address Vercel gave the project.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_SITE_URL: siteUrl },
  // Every signed-in page reads the session cookie on each request, and the door must never
  // show a stale pass. The classic request-time model fits that; Cache Components does not.
  cacheComponents: false,
  poweredByHeader: false,
  // The ticket picture (lib/ticket-image.tsx) reads its fonts from disk when it is asked for.
  // They are not imported, so say plainly that they belong to those routes.
  outputFileTracingIncludes: { "/**/ticket.png": ["./assets/fonts/*.ttf"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The scanner needs the camera; nothing else on the site does.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
