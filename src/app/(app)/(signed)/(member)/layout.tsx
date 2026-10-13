import type { ReactNode } from "react";
import { TopBar } from "@/components/app-chrome";

// The member's own screens — pass, invites, profile — share a top bar and a phone-width column.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <TopBar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-6 pt-6">{children}</main>
    </>
  );
}
