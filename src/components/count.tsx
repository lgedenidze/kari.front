"use client";

import { useState } from "react";

/** What a count shows: the number, or "99+" once the exact figure stops mattering. */
export function countText(n: number): string {
  return n > 99 ? "99+" : String(n);
}

/**
 * A count that wants an answer — requests to review, invites to reply to. A round red mark
 * with the number in it, in the ink of the ground it sits on (see `.count` in globals.css).
 *
 * Nothing is drawn at zero. The number it arrives with is not news and appears with the screen;
 * every change after that lands with a single thump, so a request that comes in while the
 * phone is in someone's hand is seen. Keep it mounted at zero for that reason: write
 * `<Count n={n} />`, not `{n > 0 && <Count n={n} />}`.
 */
export function Count({ n, ground = "ink", className = "" }: { n: number; ground?: "ink" | "paper" | "desk"; className?: string }) {
  const [seen, setSeen] = useState({ n, changes: 0 });
  if (seen.n !== n) setSeen({ n, changes: seen.changes + 1 });

  if (n <= 0) return null;
  return (
    <span
      // A new element for every change, so the thump plays again.
      key={seen.changes}
      data-count={n}
      className={`count count-on-${ground} ${seen.changes > 0 ? "count-thump" : ""} ${className}`}
    >
      {countText(n)}
    </span>
  );
}
