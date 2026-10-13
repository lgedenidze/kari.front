import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Me, PublicVenue, UserRole } from "./types";

const API_URL = () => (process.env.API_URL ?? "http://localhost:5080").replace(/\/$/, "");

/** Calls the API from a server component as the visitor, by forwarding their cookies. */
async function asVisitor<T>(path: string): Promise<T | null> {
  const store = await cookies();
  try {
    const response = await fetch(`${API_URL()}/api${path}`, {
      headers: { cookie: store.toString() },
      cache: "no-store",
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/** The signed-in visitor, or null. Asked once per request however many components need it. */
export const getMe = cache(() => asVisitor<Me>("/me"));

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
