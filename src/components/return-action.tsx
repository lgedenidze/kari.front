"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { knownSnapshot, parseKnown, watchKnown } from "@/lib/known-here";

/**
 * The landing page's one action. A stranger is asked to request access. Someone this phone
 * already knows is offered what they came for instead: a member their pass, a guest the
 * ticket they were given. The page itself stays static — this reads the browser's own
 * storage, after the page is on screen (lib/known-here.ts).
 */
export function ReturnAction({
  labels,
  tonight,
  second = false,
}: {
  labels: { request: string; haveAccount: string; myPass: string; myTicket: string };
  /** Tonight, as the API sees it. A ticket for a night already gone is not offered. */
  tonight?: string;
  /** With the quieter second action beside the first: in the hero, not at the foot. */
  second?: boolean;
}) {
  const known = parseKnown(useSyncExternalStore(watchKnown, knownSnapshot, () => "|"));
  const ticket = known.ticket && (!tonight || known.ticket.night >= tonight) ? known.ticket : null;

  if (known.member) {
    return (
      <Link href="/pass" className="btn btn-paper btn-big px-8">
        {labels.myPass}
      </Link>
    );
  }

  return (
    <>
      {ticket && (
        <Link href={ticket.href} className="btn btn-paper btn-big px-8">
          {labels.myTicket}
        </Link>
      )}
      <Link href="/join" className={ticket ? "btn btn-line text-paper-light" : "btn btn-paper btn-big px-8"}>
        {labels.request}
      </Link>
      {second && !ticket && (
        // A real button, a thumb wide: it was a line of underlined text under a large one.
        <Link href="/login" className="btn btn-line text-paper-light">
          {labels.haveAccount}
        </Link>
      )}
    </>
  );
}
