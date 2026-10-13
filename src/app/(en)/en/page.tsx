import { Landing } from "@/components/landing";
import { siteMetadata } from "@/lib/site-meta";

export const metadata = siteMetadata("en", "");

export default function Page() {
  return <Landing lang="en" />;
}
