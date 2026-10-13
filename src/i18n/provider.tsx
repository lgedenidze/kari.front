"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Lang } from "@/venue";
import { errorText, fill, formatDate, formatDateTime, formatNight, formatTime, type Dict } from "./index";

interface I18n {
  lang: Lang;
  t: Dict;
  fill: typeof fill;
  /** The message for an API error code. */
  error: (code: string | undefined | null) => string;
  night: (night: string, style?: "short" | "long") => string;
  time: (iso: string) => string;
  dateTime: (iso: string) => string;
  date: (iso: string) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ lang, dict, children }: { lang: Lang; dict: Dict; children: ReactNode }) {
  const value = useMemo<I18n>(
    () => ({
      lang,
      t: dict,
      fill,
      error: (code) => errorText(dict, code),
      night: (night, style) => formatNight(night, lang, style),
      time: (iso) => formatTime(iso),
      dateTime: (iso) => formatDateTime(iso, lang),
      date: (iso) => formatDate(iso, lang),
    }),
    [lang, dict],
  );
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
