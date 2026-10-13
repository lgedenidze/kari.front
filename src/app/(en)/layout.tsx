import type { ReactNode } from "react";
import { Shell } from "@/components/shell";

export { viewport } from "@/lib/site-meta";

// The English public pages, under /en.
export default function Layout({ children }: { children: ReactNode }) {
  return <Shell lang="en">{children}</Shell>;
}
