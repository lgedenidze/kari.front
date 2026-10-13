"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { api } from "@/lib/api";
import type { Me } from "@/lib/types";

interface MeState {
  me: Me;
  /** Takes the new account, or a function of the one there is now — for a count going down by one. */
  setMe: Dispatch<SetStateAction<Me>>;
  /** Re-reads the account from the API — after an approval, a new invite, a visit. */
  refresh: () => Promise<void>;
}

const MeContext = createContext<MeState | null>(null);

export function MeProvider({ initial, children }: { initial: Me; children: ReactNode }) {
  const [me, setMe] = useState(initial);
  const refresh = useCallback(async () => {
    try {
      const heard = await api.get<Me>("/me");
      // The same answer as last time changes nothing, so nothing on screen is drawn again:
      // an admin's dock asks every half minute, all night.
      setMe((was) => (JSON.stringify(was) === JSON.stringify(heard) ? was : heard));
    } catch {
      // Keep what we have; the next poll or navigation will try again.
    }
  }, []);
  return <MeContext value={{ me, setMe, refresh }}>{children}</MeContext>;
}

export function useMe(): MeState {
  const value = useContext(MeContext);
  if (!value) throw new Error("useMe must be used inside MeProvider");
  return value;
}

/**
 * How many requests to join are waiting for an answer. The API tells only an admin; for
 * everyone else this is 0. It is also 0 where there is no account at all — a placeholder drawn
 * for a signed-out visitor who is on their way to the sign-in page — so it never throws.
 */
export function useRequestsWaiting(): number {
  return useContext(MeContext)?.me.pendingRequests ?? 0;
}

/**
 * Runs `task` now and then every `ms`, but only while the tab is visible — a phone in a pocket
 * should not be polling. Runs again at once when the tab comes back. With `ms` of 0 it runs
 * on arrival and on coming back, and not in between. It starts over when `subject` changes:
 * a new question deserves an answer now, not at the next tick.
 */
export function usePoll(task: () => void | Promise<void>, ms: number, enabled = true, subject?: string) {
  const saved = useRef(task);
  useEffect(() => {
    saved.current = task;
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const run = () => void saved.current();
    const start = () => {
      stop();
      run();
      if (ms > 0) timer = setInterval(run, ms);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ms, enabled, subject]);
}
