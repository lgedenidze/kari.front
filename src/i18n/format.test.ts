import { describe, expect, it, vi } from "vitest";
import { errorText, fill, formatDate, formatDateTime, formatNight, formatTime, getDict } from "./index";
import { en } from "./en";
import { ka } from "./ka";

describe("dates", () => {
  // These must not depend on the browser's locale data: Chrome has none for Georgian.
  it("prints a night in Georgian without asking Intl for Georgian", () => {
    expect(formatNight("2026-10-16", "ka")).toBe("პარ, 16 ოქტ");
    expect(formatNight("2026-10-16", "ka", "long")).toBe("პარასკევი, 16 ოქტომბერი");
    expect(formatNight("2026-10-18", "ka")).toBe("კვი, 18 ოქტ");
  });

  // Regression test for BUG-0001. Node has Georgian date data and Chrome does not, so the bug
  // cannot be seen by output alone here: instead, asking Intl for Georgian at all is the failure.
  it("never asks the runtime for Georgian date data", () => {
    const RealFormat = Intl.DateTimeFormat;
    const spy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions,
    ) {
      if (String(locales).toLowerCase().startsWith("ka")) throw new Error("Georgian was requested from Intl");
      return new RealFormat(locales, options);
    } as typeof Intl.DateTimeFormat);

    try {
      expect(formatNight("2026-10-16", "ka", "long")).toBe("პარასკევი, 16 ოქტომბერი");
      expect(formatDateTime("2026-10-16T19:41:00Z", "ka")).toBe("16 ოქტ, 23:41");
      expect(formatDate("2026-10-16T19:41:00Z", "ka")).toBe("16 ოქტ 2026");
    } finally {
      spy.mockRestore();
    }
  });

  it("prints a night in English", () => {
    expect(formatNight("2026-10-16", "en")).toBe("Fri, 16 Oct");
    expect(formatNight("2026-01-01", "en", "long")).toBe("Thursday, 1 January");
  });

  it("prints the date it was given, whatever the reader's time zone", () => {
    // A night is a label from the API, not an instant: the 1st stays the 1st.
    expect(formatNight("2026-03-01", "en")).toBe("Sun, 1 Mar");
    expect(formatNight("2026-12-31", "ka")).toBe("ხუთ, 31 დეკ");
  });

  it("prints instants on the venue's clock, which is UTC+4", () => {
    expect(formatTime("2026-10-16T19:41:00Z")).toBe("23:41");
    // 21:30 UTC on Friday is already Saturday in Tbilisi.
    expect(formatTime("2026-10-16T21:30:00Z")).toBe("01:30");
    expect(formatDateTime("2026-10-16T21:30:00Z", "en")).toBe("17 Oct, 01:30");
    expect(formatDateTime("2026-10-16T19:41:00Z", "ka")).toBe("16 ოქტ, 23:41");
    expect(formatDate("2026-10-16T19:41:00Z", "ka")).toBe("16 ოქტ 2026");
  });
});

describe("dictionary", () => {
  const keys = (value: object, prefix = ""): string[] =>
    Object.entries(value).flatMap(([key, inner]) =>
      typeof inner === "string" ? [`${prefix}${key}`] : keys(inner as object, `${prefix}${key}.`),
    );

  it("has the same keys in both languages", () => {
    expect(keys(ka).sort()).toEqual(keys(en).sort());
  });

  it("leaves no string empty", () => {
    const empty = (dict: object) => keys(dict).filter((path) => path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], dict) === "");
    expect(empty(en)).toEqual([]);
    expect(empty(ka)).toEqual([]);
  });

  it("uses the same placeholders in both languages", () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const at = (dict: object, path: string) => path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], dict) as string;
    for (const path of keys(en)) {
      expect(placeholders(at(ka, path)), path).toEqual(placeholders(at(en, path)));
    }
  });

  it("fills placeholders and leaves unknown ones alone", () => {
    expect(fill("Open {open} to {close}", { open: "21:00", close: "04:00" })).toBe("Open 21:00 to 04:00");
    expect(fill("{n} nights, {other}", { n: 3 })).toBe("3 nights, {other}");
  });

  it("falls back to a generic message for an unknown error code", () => {
    expect(errorText(getDict("en"), "quota_reached")).toBe(en.errors.quota_reached);
    expect(errorText(getDict("en"), "something_new")).toBe(en.errors.validation);
    expect(errorText(getDict("ka"), null)).toBe(ka.errors.validation);
  });
});
