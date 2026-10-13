import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { getLang } from "@/i18n/server";
import { appMetadata } from "@/lib/site-meta";

export { viewport } from "@/lib/site-meta";
export const metadata = appMetadata;

// Everything behind sign-in. Here language is the visitor's saved choice, not part of the URL.
export default async function Layout({ children }: { children: ReactNode }) {
  return <Shell lang={await getLang()}>{children}</Shell>;
}
