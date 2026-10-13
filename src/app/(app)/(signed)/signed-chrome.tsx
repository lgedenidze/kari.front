"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Dock } from "@/components/app-chrome";
import { MeProvider, useMe } from "@/components/me";
import type { Me } from "@/lib/types";

export function SignedChrome({ me, children }: { me: Me; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <MeProvider initial={me}>
      <div className="flex min-h-dvh flex-col">
        {/* Keyed by the address: each screen eases in as it arrives, the dock stays put. */}
        <div key={pathname} className="page-in flex flex-1 flex-col">
          {children}
        </div>
        <SharedDock />
      </div>
    </MeProvider>
  );
}

function SharedDock() {
  const { me } = useMe();
  return <Dock role={me.role} invitesWaiting={me.pendingInvites} />;
}
