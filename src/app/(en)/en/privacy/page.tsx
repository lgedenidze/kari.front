import { Privacy } from "@/components/privacy";
import { getDict } from "@/i18n";
import { siteMetadata } from "@/lib/site-meta";

export const metadata = siteMetadata("en", "/privacy", getDict("en").privacy.title);

export default function Page() {
  return <Privacy lang="en" />;
}
