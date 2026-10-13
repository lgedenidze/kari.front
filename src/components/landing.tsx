import Link from "next/link";
import { fill, formatNight, getDict } from "@/i18n";
import { getVenue } from "@/lib/server-api";
import { venue, type Lang } from "@/venue";
import { RememberLang } from "./app-chrome";
import { SiteLangLink, VenueMark, WoxCredit, WoxLogo } from "./brand";
import { Qr } from "./qr";
import { Stamp } from "./stamp";
import { StubCode, TicketCard } from "./ticket";

/** The public front page, in one language. `/` renders it in Georgian and `/en` in English. */
export async function Landing({ lang }: { lang: Lang }) {
  const t = getDict(lang);
  const data = await getVenue();
  const tonight = data?.tonight;
  const nextOpen = data?.week.find((n) => n.open && n.night !== tonight?.night);
  const privacyHref = lang === "en" ? "/en/privacy" : "/privacy";
  const woxRing = `POWERED BY ✦ ${t.landing.doorSystemBy.toUpperCase()} ✦ POWERED BY ✦ ${t.landing.doorSystemBy.toUpperCase()} ✦ `;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BarOrPub",
    name: venue.name,
    alternateName: venue.nameKa,
    url: venue.url,
    address: { "@type": "PostalAddress", addressLocality: venue.city.en, addressCountry: "GE" },
  };

  return (
    <>
      <RememberLang lang={lang} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 pt-[max(1.1rem,env(safe-area-inset-top))] sm:px-8">
        {/* The bar's name, and with it the name of who built its door. On a phone the two
            stack, so neither is squeezed against the buttons; from a tablet up they sit
            side by side with a × between. */}
        <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <VenueMark className="text-base" />
          <span aria-hidden="true" className="hidden text-lg font-light text-ink-soft sm:inline">
            ×
          </span>
          <a
            href={venue.poweredBy.href}
            target="_blank"
            rel="noopener"
            aria-label={`${t.common.poweredBy} ${venue.poweredBy.label}`}
            className="flex items-center gap-1.5 text-paper-light opacity-90 hover:opacity-100"
          >
            <span className="text-[0.68rem] font-semibold leading-none text-ink-soft sm:hidden">{t.common.poweredBy}</span>
            {/* Two sizes, each in its own wrapper: the logo sets its own display, so hiding it
                has to be done from outside. */}
            <span className="flex sm:hidden">
              <WoxLogo height={11} />
            </span>
            <span className="hidden sm:flex">
              <WoxLogo height={17} />
            </span>
          </a>
        </div>
        <nav className="flex flex-none items-center gap-1 sm:gap-2">
          <SiteLangLink lang={lang} />
          <Link href="/login" className="btn btn-small !px-3 sm:!px-3.5">
            {t.common.signIn}
          </Link>
        </nav>
      </header>

      {/* overflow-x-clip: the stamps land from a larger size, and near the edge of a phone that
          start would otherwise count as page width and let the page slide sideways. */}
      <main className="mx-auto w-full max-w-6xl flex-1 overflow-x-clip px-5 sm:px-8">
        {/* The first screen: what this is, the one action, and the thing itself — a pass. */}
        <section className="grid items-center gap-x-10 gap-y-10 pb-14 pt-8 md:grid-cols-[1.15fr_0.85fr] md:pb-24 md:pt-16">
          <div>
            {/* The maker's seal sits in the corner of the headline, on the first screen. It is
                floated with a round outline, so the headline's lines run round it instead of
                under it — in either language, whatever the words are. On wide screens it
                moves beside the ticket instead (below). */}
            <a
              href={venue.poweredBy.href}
              target="_blank"
              rel="noopener"
              aria-label={`${t.common.poweredBy} ${venue.poweredBy.label}`}
              className="float-right -mr-1 -mt-2 ml-3 rounded-full [shape-outside:circle(50%)] xl:hidden"
            >
              <Stamp
                word="WOX.GE"
                ring={woxRing}
                ink="paper"
                size={150}
                tilt={11}
                thump
                onInk
                className="h-[5.4rem] w-[5.4rem] [animation-delay:480ms] sm:h-[7.5rem] sm:w-[7.5rem]"
              />
            </a>
            <h1 className="text-[clamp(2.9rem,12.5vw,6.25rem)] text-paper">{t.landing.title}</h1>
            <p className="mt-5 max-w-[34rem] text-[1.0625rem] text-ink-soft sm:mt-6 sm:text-xl">{t.landing.lede}</p>
            {/* On a phone the one action spans the screen, where a thumb is. */}
            <div className="mt-7 flex flex-col items-stretch gap-4 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
              <Link href="/join" className="btn btn-paper btn-big px-8">
                {t.common.requestAccess}
              </Link>
              <Link href="/login" className="link self-center text-paper-light">
                {t.landing.haveAccount}
              </Link>
            </div>

            {tonight && (
              <p className="mt-8 flex items-start gap-2.5 font-semibold text-paper-light sm:mt-10">
                {/* Nudged down to sit on the first line when the sentence wraps on a phone. */}
                <span
                  aria-hidden="true"
                  className={`mt-[0.4rem] h-3 w-3 flex-none rounded-full ${tonight.open ? "bg-go" : "border-2 border-ink-soft"}`}
                />
                <span>
                  {tonight.open
                    ? fill(t.landing.tonightOpen, { open: tonight.doorsOpen, close: tonight.doorsClose })
                    : t.landing.tonightClosed}
                  {tonight.title && `. ${tonight.title}`}
                  {!tonight.open && nextOpen && (
                    <span className="font-normal text-ink-soft">
                      {" "}
                      {fill(t.landing.nextOpen, { date: formatNight(nextOpen.night, lang, "long") })}
                    </span>
                  )}
                </span>
              </p>
            )}
          </div>

          <div className="flex justify-center md:justify-end">
            <div className="relative w-full max-w-[22rem] px-1.5 sm:px-0">
              {/* On a wide screen the seal stands on the clear ground to the ticket's left. It
                  lands a beat after the "verified" stamp, so the two read as one motion. */}
              <a
                href={venue.poweredBy.href}
                target="_blank"
                rel="noopener"
                aria-label={`${t.common.poweredBy} ${venue.poweredBy.label}`}
                className="absolute bottom-10 left-[-11rem] hidden rounded-full xl:block"
              >
                <Stamp
                  word="WOX.GE"
                  ring={woxRing}
                  ink="paper"
                  size={150}
                  tilt={-13}
                  thump
                  onInk
                  className="[animation-delay:480ms]"
                />
              </a>
              {/* A slight tilt gives the ticket life. Less of it on a phone, where a tilted
                  full-width ticket would poke past the edge of the screen. */}
              <div className="relative z-10 rotate-[1deg] sm:rotate-[2.5deg]">
              <TicketCard
                nightLabel={formatNight(tonight?.night ?? "2026-10-16", lang)}
                firstName={t.landing.sampleFirst}
                lastName={t.landing.sampleLast}
                kindLabel={t.ticket.member}
                caption={<p>{t.ticket.showAtDoor}</p>}
                stamp={<Stamp word={t.ticket.stampVerified} ink="blue" size={128} thump />}
                stubLeft={<StubCode label={t.ticket.code} code="K7QM2X" />}
                poweredBy={t.common.poweredBy}
              >
                {/* Decorative, but real: it opens this site. */}
                <Qr value={venue.url} label={venue.name} className="block w-full" />
              </TicketCard>
              </div>
            </div>
          </div>
        </section>

        {/* A real sequence, so it is numbered. */}
        <section aria-labelledby="how" className="border-t-2 border-ink-line py-12 md:py-20">
          <h2 id="how" className="text-[clamp(2rem,9vw,3rem)] text-paper">
            {t.landing.howTitle}
          </h2>
          <ol className="mt-8 grid gap-x-8 gap-y-8 md:mt-10 md:grid-cols-3 md:gap-y-10">
            {[
              [t.landing.step1Title, t.landing.step1Body],
              [t.landing.step2Title, t.landing.step2Body],
              [t.landing.step3Title, t.landing.step3Body],
            ].map(([title, body], index) => (
              <li
                key={title}
                className={`relative flex gap-5 md:flex-col md:gap-4 ${
                  // On a phone the steps stack, and a line down the numbers joins them into one path.
                  index < 2 ? "before:absolute before:left-[1.6875rem] before:top-14 before:h-[calc(100%-1.5rem)] before:w-0.5 before:bg-ink-line md:before:hidden" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className="display relative grid h-14 w-14 flex-none place-items-center rounded-full bg-paper text-3xl text-ink-deep"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-xl text-paper">{title}</h3>
                  <p className="mt-2 max-w-[26rem] text-ink-soft">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="rules" className="border-t-2 border-ink-line py-12 md:py-20">
          <div className="grid gap-x-10 gap-y-6 md:grid-cols-[0.85fr_1.15fr] md:gap-y-8">
            <h2 id="rules" className="text-[clamp(2rem,9vw,3rem)] text-paper">
              {t.landing.rulesTitle}
            </h2>
            <ul className="divide-y-2 divide-ink-line text-[1.0625rem] text-paper-light sm:text-xl [&>li]:py-4 [&>li:first-child]:pt-0 [&>li:last-child]:pb-0">
              <li>{t.landing.rule1}</li>
              <li>{fill(t.landing.rule2, { age: venue.minimumAge })}</li>
              <li>{t.landing.rule3}</li>
            </ul>
          </div>

          <div className="mt-10 flex flex-col gap-y-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-10 md:mt-14">
            <Link href="/join" className="btn btn-paper btn-big px-8">
              {t.common.requestAccess}
            </Link>
            {/* The maker's mark, in the page's own language of stamps. On a phone the hero has
                already shown it once, and the footer says it again: twice in one thumb-scroll
                would be shouting. */}
            <a
              href={venue.poweredBy.href}
              target="_blank"
              rel="noopener"
              aria-label={`${t.common.poweredBy} ${venue.poweredBy.label}`}
              className="hidden rounded-full transition-transform hover:scale-105 md:block"
            >
              <Stamp word="WOX.GE" ring={woxRing} ink="paper" size={148} tilt={8} onInk />
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-ink-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-4 px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-7 sm:px-8">
          <p className="text-sm text-ink-soft">
            <span className="font-bold text-paper-light">{venue.name}</span>, {venue.address[lang]}
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <Link href={privacyHref} className="link text-paper-light">
              {t.common.privacy}
            </Link>
            <span className="flex items-center gap-2 text-paper-light">
              <span className="text-ink-soft">{t.landing.doorSystemBy}</span>
              <WoxCredit label={t.common.poweredBy} className="text-[0.9rem] text-paper" />
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
