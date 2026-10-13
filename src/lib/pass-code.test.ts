import { describe, expect, it } from "vitest";
import { codeAt, decodeKey, formatToken, importKey, msUntilNextStep, stepAt } from "./pass-code";

// SHARED VECTOR — the same key, steps and codes are asserted in
// api/tests/Kari.Api.Tests/Domain/PassCodeTests.cs. The phone draws these codes here and the door
// checks them in C#. If either side changes, both tests must fail together.
const KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8"; // bytes 0..31

describe("pass code", () => {
  it("decodes the shared key to bytes 0..31", () => {
    expect([...decodeKey(KEY)]).toEqual([...Array(32).keys()]);
  });

  it.each([
    [0, "KW6DKEA0"],
    [1, "RGSE0PE3"],
    [58666666, "DTG30FH2"],
    [58666667, "J75FQS78"],
    [58666668, "XPRPSYPB"],
  ])("step %i draws %s — the code the API expects", async (step, expected) => {
    expect(await codeAt(await importKey(KEY), step)).toBe(expected);
  });

  it("draws the code for a key the API derived", async () => {
    // PassCode.DeriveKey("unit-test-master-secret", "0123456789ABCDEF") on the C# side.
    const derived = await importKey("E-Aqc9dtSlZxQ0cS2GwPAUN4ErEYc-I21eXoDK3kMoQ");
    expect(await codeAt(derived, 58666666)).toBe("9JJV9004");
  });

  it("changes step every thirty seconds", () => {
    const start = 58666666 * 30 * 1000;
    expect(stepAt(start)).toBe(58666666);
    expect(stepAt(start + 29_999)).toBe(58666666);
    expect(stepAt(start + 30_000)).toBe(58666667);
    expect(msUntilNextStep(start)).toBe(30_000);
    expect(msUntilNextStep(start + 29_000)).toBe(1_000);
  });

  it("formats the token the scanner parses", () => {
    expect(formatToken("0123456789ABCDEF", "J75FQS78")).toBe("K1.0123456789ABCDEF.J75FQS78");
  });
});
