import { en, type Dict } from "./en";
import { ka } from "./ka";
import type { Lang } from "@/venue";

export type { Dict };

export const dictionaries: Record<Lang, Dict> = { ka, en };

export function getDict(lang: Lang): Dict {
  return dictionaries[lang];
}

/** Fills {placeholders} in a dictionary string. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** The message for an API error code, falling back to the generic one. */
export function errorText(dict: Dict, code: string | undefined | null): string {
  const errors = dict.errors as Record<string, string>;
  return (code && errors[code]) || errors.validation;
}

// Day and month names are spelled out here rather than asked of the browser. Chrome ships no
// Georgian date data: Intl.DateTimeFormat("ka-GE") quietly answers in English there, while
// the server answers in Georgian — wrong on screen, and a hydration mismatch besides.
const WEEKDAYS: Record<Lang, { short: string[]; long: string[] }> = {
  ka: {
    short: ["კვი", "ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ"],
    long: ["კვირა", "ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი"],
  },
  en: {
    short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    long: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  },
};

const MONTHS: Record<Lang, { short: string[]; long: string[] }> = {
  ka: {
    short: ["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"],
    long: [
      "იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი",
      "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი",
    ],
  },
  en: {
    short: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    long: [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ],
  },
};

/**
 * Formats a night ("2026-10-16") for display, e.g. "პარ, 16 ოქტ" or "Friday, 16 October".
 * The API decides which night it is; this only prints the date it was given, read as plain
 * numbers so no time zone can shift it.
 */
export function formatNight(night: string, lang: Lang, style: "short" | "long" = "short"): string {
  const [year, month, day] = night.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${WEEKDAYS[lang][style][weekday]}, ${day} ${MONTHS[lang][style][month - 1]}`;
}

/** The month a night falls in, e.g. "ოქტომბერი" — a heading for a calendar. */
export function formatMonth(night: string, lang: Lang): string {
  return MONTHS[lang].long[Number(night.split("-")[1]) - 1];
}

/** 0 = Sunday … 6 = Saturday, for laying a night out in a calendar grid. */
export function weekdayOf(night: string): number {
  const [year, month, day] = night.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// The numbers of an instant on the venue's clock. Formatted as en-GB digits, which every
// browser has; the words around them come from the tables above.
const VENUE_CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tbilisi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function venueParts(iso: string) {
  const parts = Object.fromEntries(VENUE_CLOCK.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** A clock time in the venue's zone, e.g. "23:41". */
export function formatTime(iso: string): string {
  return venueParts(iso).time;
}

/** e.g. "16 ოქტ, 23:41". */
export function formatDateTime(iso: string, lang: Lang): string {
  const { month, day, time } = venueParts(iso);
  return `${day} ${MONTHS[lang].short[month - 1]}, ${time}`;
}

/** The year of an instant on the venue's clock, e.g. "2026". */
export function formatYear(iso: string): string {
  return String(venueParts(iso).year);
}

/** e.g. "16 ოქტ 2026". */
export function formatDate(iso: string, lang: Lang): string {
  const { year, month, day } = venueParts(iso);
  return `${day} ${MONTHS[lang].short[month - 1]} ${year}`;
}
