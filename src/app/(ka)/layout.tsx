import type { ReactNode } from "react";
import { Shell } from "@/components/shell";

export { viewport } from "@/lib/site-meta";

// The Georgian public pages. Their language is fixed by the URL, so they render statically.
export default function Layout({ children }: { children: ReactNode }) {
  return <Shell lang="ka">{children}</Shell>;
}
