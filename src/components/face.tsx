"use client";

import { useState } from "react";

/**
 * A person's photo, from the API. A photo that will not load — the file is gone, the signal
 * dropped — leaves nothing behind: never the browser's broken-picture mark beside a name.
 */
export function Face({ userId, className = "" }: { userId: string; className?: string }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- an authenticated API image
    <img src={`/api/photos/${userId}`} alt="" className={className} onError={() => setGone(true)} />
  );
}
