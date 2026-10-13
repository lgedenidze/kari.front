import { manifestResponse } from "@/lib/web-manifest";

// An invited guest has no account. Saved to their home screen, the icon must open this
// invite's own link — their ticket — not the members' pass page.
export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  if (!/^[a-z0-9]{10,16}$/.test(code)) return new Response(null, { status: 404 });
  return manifestResponse(`/i/${code}`);
}
