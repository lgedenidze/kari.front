import { describe, expect, it } from "vitest";
import { codeIdentity, createPresence } from "./scan-presence";

const A = "PASSAAAAAAAAAAAA";
const B = "PASSBBBBBBBBBBBB";
const FRAME = 130;

describe("which pass a code is for", () => {
  it("is the pass id, whatever code the pass is showing", () => {
    expect(codeIdentity(`K1.${A}.J75FQS78`)).toBe(A);
    // Thirty seconds later the same pass shows a new code: still the same pass.
    expect(codeIdentity(`K1.${A}.XPRPSYPB`)).toBe(A);
    expect(codeIdentity(` k1.${A}.J75FQS78 `.replace("k1", "K1"))).toBe(A);
  });

  it("is the whole text for anything that is not a pass", () => {
    expect(codeIdentity("https://example.com/menu")).toBe("https://example.com/menu");
    expect(codeIdentity("K2.something.else")).toBe("K2.something.else");
  });
});

describe("one read per showing", () => {
  it("reports a pass once, however many frames see it", () => {
    const presence = createPresence();
    let reports = 0;
    for (let t = 0; t < 5000; t += FRAME) if (presence.see(A, t)) reports++;
    expect(reports).toBe(1);
  });

  it("is not fooled by a frame or two where the code was not read", () => {
    const presence = createPresence();
    expect(presence.see(A, 0)).toBe(true);
    expect(presence.see(null, 130)).toBe(false); // a blurred frame
    expect(presence.see(null, 260)).toBe(false);
    expect(presence.see(A, 390)).toBe(false); // the same showing, not a new one
  });

  it("reads the pass again once it has gone away and come back", () => {
    const presence = createPresence();
    expect(presence.see(A, 0)).toBe(true);
    expect(presence.see(null, 500)).toBe(false);
    expect(presence.see(A, 1400)).toBe(false); // back too soon: still the same showing
    expect(presence.see(null, 1500)).toBe(false);
    expect(presence.see(null, 3100)).toBe(false); // gone for 1.7 s
    expect(presence.see(A, 3200)).toBe(true); // a new showing
  });

  // Regression test for BUG-0002: the pass was read a second time, straight after a decision.
  it("does not read the pass again when staff decide and the phone is still held up", () => {
    const presence = createPresence();
    expect(presence.see(A, 0)).toBe(true); // read; the result sheet opens and reading stops

    // Staff take eight seconds to look at the card and tap Admit. No frames are read.
    presence.resume(8000);

    // The guest's phone is still in front of the camera.
    let reports = 0;
    for (let t = 8000; t < 11000; t += FRAME) if (presence.see(A, t)) reports++;
    expect(reports).toBe(0);
  });

  it("still does not read it when the pass rotated its code while the result was up", () => {
    const presence = createPresence();
    expect(presence.see(codeIdentity(`K1.${A}.J75FQS78`), 0)).toBe(true);
    presence.resume(40_000); // a long look; the phone has moved on to its next code
    expect(presence.see(codeIdentity(`K1.${A}.XPRPSYPB`), 40_100)).toBe(false);
  });

  it("reads the next guest at once, without waiting for the last one to leave", () => {
    const presence = createPresence();
    expect(presence.see(A, 0)).toBe(true);
    presence.resume(6000);
    expect(presence.see(B, 6100)).toBe(true);
  });

  it("does not flap when two phones are in the frame together", () => {
    const presence = createPresence();
    let reports = 0;
    // The reader picks one or the other from frame to frame.
    for (let t = 0, i = 0; t < 4000; t += FRAME, i++) if (presence.see(i % 2 ? A : B, t)) reports++;
    expect(reports).toBe(2); // each pass once
  });

  it("reads a returning guest after they have really been away", () => {
    const presence = createPresence();
    expect(presence.see(A, 0)).toBe(true);
    presence.resume(5000);
    expect(presence.see(A, 5100)).toBe(false); // still here
    // They walk in. Twenty minutes later they are back from a cigarette.
    expect(presence.see(null, 7000)).toBe(false);
    expect(presence.see(A, 1_200_000)).toBe(true);
  });
});
