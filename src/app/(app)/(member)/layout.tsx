import type { ReactNode } from "react";
import { MemberChrome } from "./member-chrome";
import { getMe } from "@/lib/server-api";

// The member's three screens share one frame. Each page does its own requireMe() so that a
// signed-out visitor is sent back to the exact page they asked for; if there is no session
// this layout just steps aside and lets that redirect happen.
export default async function Layout({ children }: { children: ReactNode }) {
  const me = await getMe();
  if (!me) return children;
  return <MemberChrome me={me}>{children}</MemberChrome>;
}
