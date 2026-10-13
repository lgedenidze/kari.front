import { Privacy } from "@/components/privacy";
import { getDict } from "@/i18n";
import { siteMetadata } from "@/lib/site-meta";

export const metadata = siteMetadata("ka", "/privacy", getDict("ka").privacy.title);

export default function Page() {
  return <Privacy lang="ka" />;
}
