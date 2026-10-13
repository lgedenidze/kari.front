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

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 pt-5 sm:px-8">
        {/* The bar's name, and beside it the name of who built its door. */}
        <div className="flex min-w-0 items-center gap-3">
          <VenueMark className="text-base" />
          <span aria-hidden="true" className="text-lg font-light text-ink-soft">
            ×
          </span>
          <a
            href={venue.poweredBy.href}
            target="_blank"
            rel="noopener"
            aria-label={`${t.common.poweredBy} ${venue.poweredBy.label}`}
            className="flex items-center text-paper-light opacity-90 hover:opacity-100"
          >
            <WoxLogo height={17} />
          </a>
        </div>
        <nav className="flex flex-none items-center gap-2">
          <SiteLangLink lang={lang} />
          <Link href="/login" className="btn btn-small">
            {t.common.signIn}
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 sm:px-8">
        {/* The first screen: what this is, the one action, and the thing itself — a pass. */}
        <section className="grid items-center gap-x-10 gap-y-12 pb-16 pt-10 md:grid-cols-[1.15fr_0.85fr] md:pb-24 md:pt-16">
          <div>
            <h1 className="text-[clamp(3rem,11.5vw,6.25rem)] text-paper">{t.landing.title}</h1>
            <p className="mt-6 max-w-[34rem] text-lg text-ink-soft sm:text-xl">{t.landing.lede}</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link href="/join" className="btn btn-paper btn-big px-8">
                {t.common.requestAccess}
              </Link>
              <Link href="/login" className="link text-paper-light">
                {t.landing.haveAccount}
              </Link>
            </div>

            {tonight && (
              <p className="mt-10 flex items-center gap-2.5 font-semibold text-paper-light">
                <span
                  aria-hidden="true"
                  className={`h-3 w-3 flex-none rounded-full ${tonight.open ? "bg-go" : "border-2 border-ink-soft"}`}
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
            {/* Room is kept under the ticket for the seal; from xl up it moves to the ticket's
                left, where there is clear ground. Either way it is whole — never tucked under. */}
            <div className="relative w-full max-w-[22rem] pb-44 xl:pb-0">
              {/* The maker's seal. It lands a beat after the "verified" stamp, so the two read
                  as one motion. */}
              <a
                href={venue.poweredBy.href}
                target="_blank"
                rel="noopener"
                aria-label={`${t.common.poweredBy} ${venue.poweredBy.label}`}
                className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full xl:bottom-10 xl:left-[-11rem] xl:translate-x-0"
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
              <div className="relative z-10 rotate-[2.5deg]">
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
        <section aria-labelledby="how" className="border-t-2 border-ink-line py-14 md:py-20">
          <h2 id="how" className="text-4xl text-paper sm:text-5xl">
            {t.landing.howTitle}
          </h2>
          <ol className="mt-10 grid gap-x-8 gap-y-10 md:grid-cols-3">
            {[
              [t.landing.step1Title, t.landing.step1Body],
              [t.landing.step2Title, t.landing.step2Body],
              [t.landing.step3Title, t.landing.step3Body],
            ].map(([title, body], index) => (
              <li key={title} className="flex gap-5 md:flex-col md:gap-4">
                <span
                  aria-hidden="true"
                  className="display grid h-14 w-14 flex-none place-items-center rounded-full bg-paper text-3xl text-ink-deep"
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

        <section aria-labelledby="rules" className="border-t-2 border-ink-line py-14 md:py-20">
          <div className="grid gap-x-10 gap-y-8 md:grid-cols-[0.85fr_1.15fr]">
            <h2 id="rules" className="text-4xl text-paper sm:text-5xl">
              {t.landing.rulesTitle}
            </h2>
            <ul className="space-y-5 text-lg text-paper-light sm:text-xl">
              <li>{t.landing.rule1}</li>
              <li>{fill(t.landing.rule2, { age: venue.minimumAge })}</li>
              <li>{t.landing.rule3}</li>
              <li>{t.landing.rule4}</li>
            </ul>
          </div>

          <div className="mt-14 flex flex-wrap items-center justify-between gap-x-10 gap-y-8">
            <Link href="/join" className="btn btn-paper btn-big px-8">
              {t.common.requestAccess}
            </Link>
            {/* The maker's mark, in the page's own language of stamps. */}
            <a
              href={venue.poweredBy.href}
              target="_blank"
              rel="noopener"
              aria-label={`${t.common.poweredBy} ${venue.poweredBy.label}`}
              className="rounded-full transition-transform hover:scale-105"
            >
              <Stamp word="WOX.GE" ring={woxRing} ink="paper" size={148} tilt={8} onInk />
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-ink-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-4 px-5 py-7 sm:px-8">
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
