// The rule that makes a door scanner read each pass once per time it is shown.
//
// A camera sees the same QR in frame after frame — seven or eight times a second. Without a
// rule, one guest becomes a stream of scans. Worse: a guest holds their phone up, staff tap
// Admit, and the phone is still in front of the lens when the scanner wakes — so it reads the
// pass again and reports a "re-entry" for someone who never left.
//
// The rule, as on any kiosk scanner: a code is read once per showing. To be read again it has
// to go out of the frame, stay out for a moment, and come back.

/** How long a code must be out of the frame before it will be read again. */
export const REARM_AFTER_ABSENT_MS = 1500;

/**
 * Which pass a QR is for, whatever code it is showing right now. A pass QR is
 * "K1.<pass id>.<code>" and the code changes every thirty seconds; the pass id does not, so a
 * pass that rotates while it is being held up is still the same showing.
 * Anything else is identified by its whole text.
 */
export function codeIdentity(raw: string): string {
  const parts = raw.trim().split(".");
  return parts.length === 3 && parts[0] === "K1" ? parts[1].toUpperCase() : raw.trim();
}

export interface Presence {
  /** A frame saw this code — or nothing (null). True when it is a new showing to report. */
  see(identity: string | null, now: number): boolean;
  /** Reading starts again after a pause (a result was on screen). */
  resume(now: number): void;
}

export function createPresence(rearmAfterAbsentMs = REARM_AFTER_ABSENT_MS): Presence {
  // Every code still considered "in front of the camera", with when a frame last saw it.
  // More than one, because two phones are often held up together and the reader flips
  // between them from frame to frame.
  const inView = new Map<string, number>();
  let lastReported: string | null = null;

  return {
    see(identity, now) {
      // Anything unseen for long enough has left, and may be read afresh when it returns.
      for (const [id, at] of inView) {
        if (now - at >= rearmAfterAbsentMs) inView.delete(id);
      }
      if (identity === null) return false;

      const stillInView = inView.has(identity);
      inView.set(identity, now);
      if (stillInView) return false;

      lastReported = identity;
      return true;
    },

    resume(now) {
      // No frames were read while the result was up, so the pass that was just decided looks
      // long gone. It is almost certainly still there: count it as seen this instant, and it
      // must now really leave before it can be read again.
      if (lastReported !== null) inView.set(lastReported, now);
    },
  };
}
