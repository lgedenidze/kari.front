import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Me, PublicVenue, UserRole } from "./types";

const API_URL = () => (process.env.API_URL ?? "http://localhost:5080").replace(/\/$/, "");

/** Calls the API from a server component as the visitor, by forwarding their cookies. */
async function asVisitor<T>(path: string, timeoutMs?: number): Promise<T | null> {
  const [store, incoming] = await Promise.all([cookies(), headers()]);
  const forwarded: Record<string, string> = { cookie: store.toString() };
  // The guest's own address, for the API's rate limiter — as the /api proxy sends it.
  const client = incoming.get("x-forwarded-for")?.split(",")[0]?.trim() ?? incoming.get("x-real-ip");
  if (client) forwarded["x-forwarded-for"] = client;
  try {
    const response = await fetch(`${API_URL()}/api${path}`, {
      headers: forwarded,
      cache: "no-store",
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/** The signed-in visitor, or null. Asked once per request however many components need it. */
export const getMe = cache(() => asVisitor<Me>("/me"));

/**
 * A screen's first answer, fetched while the page itself is being made, so the screen opens
 * already filled in instead of opening empty and asking. Null when the API refuses or is slow:
 * the screen then asks for itself, exactly as it does on every later poll.
 */
export function firstAnswer<T>(path: string): Promise<T | null> {
  return asVisitor<T>(path, 4000);
}

/** For pages behind sign-in. Sends everyone else to /login and brings them back afterwards. */
export async function requireMe(returnTo: string, roles?: UserRole[]): Promise<Me> {
  const me = await getMe();
  if (!me) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (roles && !roles.includes(me.role)) redirect("/pass");
  return me;
}

/**
 * Tonight and the coming week, for the public landing page. Cached for a minute so the page
 * stays static; null when the API is down, and the page simply leaves the strip out.
 */
export async function getVenue(): Promise<PublicVenue | null> {
  try {
    const response = await fetch(`${API_URL()}/api/public/venue`, { next: { revalidate: 60 } });
    return response.ok ? ((await response.json()) as PublicVenue) : null;
  } catch {
    return null;
  }
}
