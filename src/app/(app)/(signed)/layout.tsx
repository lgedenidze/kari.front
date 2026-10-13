import type { ReactNode } from "react";
import { getMe } from "@/lib/server-api";
import { SignedChrome } from "./signed-chrome";

// One frame for every signed-in screen — the pass, invites, profile, the door, the back
// office. The dock lives here, above them all, so it is built once and never torn down: moving
// from the pass to the door slides the dock's marker instead of redrawing the bar.
//
// Each page still calls requireMe() itself, with its own path and roles, so a signed-out
// visitor is sent back to exactly the page they asked for. With no session this layout simply
// steps aside and lets that redirect happen.
export default async function Layout({ children }: { children: ReactNode }) {
  const me = await getMe();
  if (!me) return children;
  return <SignedChrome me={me}>{children}</SignedChrome>;
}
