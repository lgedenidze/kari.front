"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { api, isApiError } from "@/lib/api";
import { openFresh } from "@/lib/fresh-page";
import { ask, askPatiently, peek, put, watch } from "@/lib/live-store";
import { usePoll } from "./me";

// With something already on screen, one failed refresh is not worth a red box: the screen
// keeps what it has, and says so only when asking has failed this many times running. (Each
// of those has already been retried — see askPatiently.)
const QUIET_FAILURES = 2;

interface Live<T> {
  /** What to show: the last answer this phone heard, else what came with the page, else nothing yet. */
  data: T | null;
  /**
   * The code of a failure worth showing. Null while a failed request is still being retried,
   * and null for a passing failure behind a screen that has its content.
   */
  failure: string | null;
  /** The API said there is no such thing. Asking stops. */
  missing: boolean;
  reload: () => Promise<void>;
  /** Puts an answer on screen at once — the reply to a button, which is newer than any poll. */
  set: (data: T) => void;
}

/**
 * One screen's data, kept current.
 *
 * `first` is what the server sent along with the page, so a screen opens already filled in.
 * Every later answer is remembered (lib/live-store.ts): leaving a tab and coming back shows
 * what was there, at once, and asks again behind it. With `every`, it keeps asking while the
 * tab is visible.
 */
export function useLive<T>(
  path: string,
  { every, first = null, enabled = true }: { every?: number; first?: T | null; enabled?: boolean } = {},
): Live<T> {
  const subscribe = useCallback((notify: () => void) => watch(path, notify), [path]);
  const heard = useSyncExternalStore(
    subscribe,
    () => peek<T>(path),
    () => undefined,
  );
  // Kept with the path it belongs to, so a failure for one night is not shown on the next.
  const [trouble, setTrouble] = useState<{ path: string; code: string; missing: boolean; times: number } | null>(null);
  // What is being asked for right now, retries included. A poll that comes round meanwhile
  // has nothing to add.
  const asking = useRef<string | null>(null);

  const reload = useCallback(async () => {
    if (asking.current === path) return;
    asking.current = path;
    try {
      await askPatiently(path, () => api.get<T>(path));
      setTrouble(null);
    } catch (error) {
      // The session ended while the app was open: the only useful place is the sign-in page.
      if (isApiError(error) && error.status === 401) {
        openFresh(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const code = isApiError(error) ? error.code : "server_error";
      const missing = isApiError(error) && error.status === 404;
      setTrouble((was) => ({ path, code, missing, times: was?.path === path ? was.times + 1 : 1 }));
    } finally {
      if (asking.current === path) asking.current = null;
    }
  }, [path]);

  const mine = trouble?.path === path ? trouble : null;
  const missing = mine?.missing ?? false;
  const data = heard ?? first ?? null;

  // With no interval this still asks once on arrival, and again when the tab comes back.
  usePoll(reload, every ?? 0, enabled && !missing, path);

  const set = useCallback((answer: T) => put(path, answer), [path]);

  const worthSaying = mine !== null && (data === null || mine.times >= QUIET_FAILURES);
  return { data, failure: worthSaying ? mine.code : null, missing, reload, set };
}

/** Asks for another screen's data now, so it is already there when that screen is opened. */
export function refreshLive(path: string): void {
  void ask(path, () => api.get(path)).catch(() => {
    // That screen asks again itself when it opens.
  });
}
