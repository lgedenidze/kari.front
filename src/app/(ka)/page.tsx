import { Landing } from "@/components/landing";
import { siteMetadata } from "@/lib/site-meta";

export const metadata = siteMetadata("ka", "");

export default function Page() {
  return <Landing lang="ka" />;
}
