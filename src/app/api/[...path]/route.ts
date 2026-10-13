import type { NextRequest } from "next/server";

// The browser only ever talks to this site. Every /api/* call is passed on to the .NET API
// from here, which keeps the session cookie same-origin and the API's address out of the
// client. Read at request time, so API_URL can change without a rebuild.
const API_URL = () => (process.env.API_URL ?? "http://localhost:5080").replace(/\/$/, "");

// Request headers the API needs. Origin and Sec-Fetch-Site carry its cross-site check.
const FORWARD = ["cookie", "content-type", "accept", "accept-language", "user-agent", "origin", "sec-fetch-site"];

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const target = `${API_URL()}/api/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARD) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // The guest's own address, for the API's rate limiter.
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
  if (client) headers.set("x-forwarded-for", client);
  // The host the browser asked for. The API compares it with Origin to tell this site's own
  // pages from a foreign one, so the site can change domain without reconfiguring the API.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) headers.set("x-forwarded-host", host);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return Response.json({ error: "api_unreachable" }, { status: 502 });
  }

  const responseHeaders = new Headers();
  for (const name of ["content-type", "cache-control"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  for (const cookie of upstream.headers.getSetCookie()) responseHeaders.append("set-cookie", cookie);

  return new Response(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
