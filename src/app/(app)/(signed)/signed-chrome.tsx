"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dock } from "@/components/app-chrome";
import { MeProvider, useMe, usePoll } from "@/components/me";
import { rememberMember } from "@/lib/known-here";
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

  // So the landing page offers this phone its pass next time, not "request access".
  useEffect(() => rememberMember(), []);

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
        <SharedDock shown={heading ?? pathname} at={pathname} onTap={onTap} />
      </div>
    </MeProvider>
  );
}

function SharedDock({ shown, at, onTap }: { shown: string; at: string; onTap: (href: string) => void }) {
  const { me, refresh } = useMe();
  const router = useRouter();
  // The account is changed by somebody else — an admin makes this person door staff, switches
  // their invites off, approves them; a friend sends them an invite; a guest asks to join — on
  // a screen that may stay open all night. So it is asked for again every half minute, on every
  // move to another screen, and whenever the app comes back into view. For everyone: it used
  // to be asked only for an admin, and anyone else kept the dock they had signed in with
  // (BUG-0007).
  usePoll(refresh, 30_000, true, at);

  // A new role or standing changes what the pages themselves will show, and whether this one
  // may be shown at all. They are made again on the server, which sends a person who has just
  // lost the door or the office back to their pass.
  const standing = `${me.role} ${me.status}`;
  const heard = useRef(standing);
  useEffect(() => {
    if (heard.current === standing) return;
    heard.current = standing;
    router.refresh();
  }, [standing, router]);

  return (
    <Dock
      role={me.role}
      canInvite={me.canInvite}
      invitesWaiting={me.pendingInvites}
      // Missing only while an older API is still answering, in the minutes of a release.
      requestsWaiting={me.pendingRequests ?? 0}
      shown={shown}
      onTap={onTap}
    />
  );
}
