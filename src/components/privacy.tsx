import Link from "next/link";
import { fill, getDict } from "@/i18n";
import { venue, type Lang } from "@/venue";
import { SiteLangLink, VenueMark } from "./brand";

/** The privacy page, in one language. Plain statements: what is kept, why, who sees it, how to erase it. */
export function Privacy({ lang }: { lang: Lang }) {
  const t = getDict(lang).privacy;
  const sections: [string, string[]][] = [
    [t.whatTitle, [t.what1, t.what2, t.what3, t.what4]],
    [t.whyTitle, [t.why1, t.why2]],
    [t.whoTitle, [t.who1, t.who2]],
    [t.removeTitle, [t.remove1, t.remove2]],
    [t.contactTitle, [t.contact1]],
  ];

  return (
    <>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-5 pt-[max(1.1rem,env(safe-area-inset-top))] sm:px-8">
        <Link href={lang === "en" ? "/en" : "/"}>
          <VenueMark className="text-base" />
        </Link>
        <SiteLangLink lang={lang} path="/privacy" />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-[max(3rem,env(safe-area-inset-bottom))] pt-9 sm:px-8 sm:pt-12">
        {/* The Georgian title is one seventeen-letter word: sized to the screen, not to a scale. */}
        <h1 className="text-[clamp(1.5rem,8.3vw,3.75rem)] text-paper">{t.title}</h1>
        <p className="mt-4 text-[1.0625rem] text-ink-soft sm:mt-5 sm:text-lg">{fill(t.intro, { venue: venue.name })}</p>
        {sections.map(([title, lines]) => (
          <section key={title} className="mt-9 sm:mt-10">
            <h2 className="text-2xl text-paper">{title}</h2>
            <ul className="mt-3 space-y-2.5 text-paper-light">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}
