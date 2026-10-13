"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { Me } from "@/lib/types";

interface MeState {
  me: Me;
  setMe: (me: Me) => void;
  /** Re-reads the account from the API — after an approval, a new invite, a visit. */
  refresh: () => Promise<void>;
}

const MeContext = createContext<MeState | null>(null);

export function MeProvider({ initial, children }: { initial: Me; children: ReactNode }) {
  const [me, setMe] = useState(initial);
  const refresh = useCallback(async () => {
    try {
      setMe(await api.get<Me>("/me"));
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
 * Runs `task` now and then every `ms`, but only while the tab is visible — a phone in a pocket
 * should not be polling. Runs again at once when the tab comes back.
 */
export function usePoll(task: () => void | Promise<void>, ms: number, enabled = true) {
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
      timer = setInterval(run, ms);
    };
    const stop = () => timer && clearInterval(timer);
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ms, enabled]);
}
