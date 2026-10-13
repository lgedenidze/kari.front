// What each screen last heard from the API, kept for as long as the app is open.
//
// A screen that is opened a second time shows this at once and asks again behind it, instead
// of starting from a placeholder. Browser-only: nothing is ever written here while rendering
// on the server, where one module is shared by every visitor.

import { isApiError } from "./api";

/** How long an answer nobody is looking at is kept. After that the screen starts clean. */
export const KEEP_MS = 5 * 60 * 1000;

const answers = new Map<string, unknown>();
const watchers = new Map<string, Set<() => void>>();
const flights = new Map<string, Promise<unknown>>();
const writes = new Map<string, number>();
const expiry = new Map<string, ReturnType<typeof setTimeout>>();

function watched(key: string): boolean {
  return (watchers.get(key)?.size ?? 0) > 0;
}

function keepOrExpire(key: string) {
  const timer = expiry.get(key);
  if (timer) clearTimeout(timer);
  expiry.delete(key);
  if (!watched(key) && answers.has(key)) {
    expiry.set(
      key,
      setTimeout(() => {
        expiry.delete(key);
        if (!watched(key)) answers.delete(key);
      }, KEEP_MS),
    );
  }
}

/** The last answer for `key`, or undefined. */
export function peek<T>(key: string): T | undefined {
  return answers.get(key) as T | undefined;
}

/** Stores an answer and tells every screen showing it. */
export function put<T>(key: string, data: T): void {
  answers.set(key, data);
  writes.set(key, (writes.get(key) ?? 0) + 1);
  keepOrExpire(key);
  for (const notify of [...(watchers.get(key) ?? [])]) notify();
}

/** Calls `notify` whenever the answer for `key` changes. Returns the way to stop. */
export function watch(key: string, notify: () => void): () => void {
  let set = watchers.get(key);
  if (!set) watchers.set(key, (set = new Set()));
  set.add(notify);
  keepOrExpire(key);
  return () => {
    set.delete(notify);
    keepOrExpire(key);
  };
}

/**
 * Asks again and stores the answer. Two callers asking for the same thing at once share one
 * request. An answer that was already on its way when something newer was stored — the reply
 * to a button, say — is dropped: it describes the moment before.
 */
export function ask<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const flying = flights.get(key) as Promise<T> | undefined;
  if (flying) return flying;

  const written = writes.get(key) ?? 0;
  const flight = fetcher()
    .then((data) => {
      if ((writes.get(key) ?? 0) === written) put(key, data);
      return data;
    })
    .finally(() => {
      if (flights.get(key) === flight) flights.delete(key);
    });
  flights.set(key, flight);
  return flight;
}

/** Forgets everything: on signing in or out, so one account never sees another's screens. */
export function forgetAll(): void {
  for (const timer of expiry.values()) clearTimeout(timer);
  expiry.clear();
  // A request still on its way belongs to the account that is leaving: mark every key as
  // written, so its answer is dropped when it lands.
  const keys = new Set([...answers.keys(), ...flights.keys(), ...watchers.keys()]);
  flights.clear();
  answers.clear();
  for (const key of keys) {
    writes.set(key, (writes.get(key) ?? 0) + 1);
    for (const notify of [...(watchers.get(key) ?? [])]) notify();
  }
}

// A request that fails is tried again, twice, a little later each time, before anyone is told.
// A bad moment on the network or the server is common, and passes by itself.
export const RETRY_AFTER_MS = [600, 1400];

/** A refusal is an answer, and asking again gets the same one. Only a failure is worth retrying. */
export function mayPass(error: unknown): boolean {
  if (!isApiError(error)) return true;
  return error.status === 0 || error.status >= 500;
}

/** `ask`, with patience: a failure that may pass is retried before it is reported. */
export async function askPatiently<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await ask(key, fetcher);
    } catch (error) {
      if (attempt >= RETRY_AFTER_MS.length || !mayPass(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS[attempt]));
    }
  }
}
