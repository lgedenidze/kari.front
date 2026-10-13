import type { ReactNode } from "react";
import { Noto_Sans_Georgian } from "next/font/google";
import { getDict } from "@/i18n";
import { I18nProvider } from "@/i18n/provider";
import type { Lang } from "@/venue";
import "@/app/globals.css";

// One family for both scripts, with a width axis: headlines are the condensed cut, body is
// the regular one. Georgian and Latin stay in step because they are the same typeface.
const noto = Noto_Sans_Georgian({
  subsets: ["georgian", "latin"],
  axes: ["wdth"],
  variable: "--font-noto",
  display: "swap",
});

/** The html and body shared by every root layout. */
export function Shell({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    <html lang={lang} className={`${noto.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider lang={lang} dict={getDict(lang)}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
