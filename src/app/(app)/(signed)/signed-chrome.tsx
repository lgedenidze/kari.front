"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Dock } from "@/components/app-chrome";
import { MeProvider, useMe } from "@/components/me";
import type { Me } from "@/lib/types";

export function SignedChrome({ me, children }: { me: Me; children: ReactNode }) {
  const pathname = usePathname();
  // A tap on the dock, kept with the page it was made on — so it stops counting by itself the
  // moment the address changes, wherever the navigation ended up.
  const [tapped, setTapped] = useState<{ href: string; from: string } | null>(null);
  const heading = tapped && tapped.from === pathname ? tapped.href : null;
  // The screen being left. Nearly always the next one is already in hand and replaces it
  // before this shows; when it is not, the old screen steps back so the tap is plainly answered.
  const leaving = heading !== null && !pathname.startsWith(heading);

  function onTap(href: string) {
    const tap = { href, from: pathname };
    setTapped(tap);
    // If the page never comes (no signal), do not leave the screen stepped back for good.
    setTimeout(() => setTapped((current) => (current === tap ? null : current)), 8000);
  }

  return (
    <MeProvider initial={me}>
      <div className="flex min-h-dvh flex-col">
        {/* Keyed by the address: each screen eases in as it arrives, the dock stays put. */}
        <div key={pathname} className={`page-in flex flex-1 flex-col ${leaving ? "leaving" : ""}`}>
          {children}
        </div>
        <SharedDock shown={heading ?? pathname} onTap={onTap} />
      </div>
    </MeProvider>
  );
}

function SharedDock({ shown, onTap }: { shown: string; onTap: (href: string) => void }) {
  const { me } = useMe();
  return <Dock role={me.role} invitesWaiting={me.pendingInvites} shown={shown} onTap={onTap} />;
}
