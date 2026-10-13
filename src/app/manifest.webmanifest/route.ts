import { manifestResponse } from "@/lib/web-manifest";

// The site's manifest: saved to a home screen, the icon opens the member's pass.
export const dynamic = "force-static";

export function GET() {
  return manifestResponse("/pass");
}
