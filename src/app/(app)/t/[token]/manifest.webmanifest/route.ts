import { manifestResponse } from "@/lib/web-manifest";

// A walk-in has no account. Saved to their home screen, the icon must open this ticket's
// own link.
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[a-z0-9]{16,24}$/.test(token)) return new Response(null, { status: 404 });
  return manifestResponse(`/t/${token}`);
}
