import { venue, type Lang } from "@/venue";

/** The venue's wordmark: the Latin name set tight, with the Georgian name riding beside it. */
export function VenueMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`}>
      <span className="display text-[1.55em] tracking-[0.04em]">{venue.name}</span>
      <span className="text-[0.8em] font-semibold opacity-80" lang="ka">
        {venue.nameKa}
      </span>
    </span>
  );
}

/**
 * The Wox wordmark, from Wox's own artwork (public/wox/wox-wordmark-white.png). It is used as
 * a mask, so it takes the colour of the text around it and works on ink and on paper alike.
 * The file also carries a "POS SYSTEM" line under the letters; the box is cut short of it,
 * because at these sizes it would be an unreadable smudge.
 */
export function WoxLogo({ height = 18, className = "" }: { height?: number; className?: string }) {
  const LETTERS = 0.6; // the share of the artwork's height the three letters take up
  const width = (height / LETTERS) * (1508 / 584);
  return (
    <span
      role="img"
      aria-label="Wox"
      className={`inline-block flex-none bg-current ${className}`}
      style={{
        width,
        height,
        maskImage: "url(/wox/wox-wordmark-white.png)",
        WebkitMaskImage: "url(/wox/wox-wordmark-white.png)",
        maskSize: "100% auto",
        WebkitMaskSize: "100% auto",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "top left",
        WebkitMaskPosition: "top left",
      }}
    />
  );
}

/** The Wox mark: the open ring and its dot, as in wox-logo.svg. The dot keeps Wox's purple. */
export function WoxMark({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true" className="flex-none">
      <path
        d="M 405.22 309.43 A 158.50 158.50 0 1 1 405.22 202.57"
        fill="none"
        stroke="currentColor"
        strokeWidth="63"
        strokeLinecap="round"
      />
      <circle cx="256" cy="256" r="61" fill="var(--wox-dot, #7b5fcb)" />
    </svg>
  );
}

/**
 * The agency credit. It appears where guests actually look — the stub of every pass and the
 * foot of the landing page — set small, so the bar's name is always the loud one.
 */
export function WoxCredit({ label, className = "" }: { label: string; className?: string }) {
  return (
    <a
      href={venue.poweredBy.href}
      target="_blank"
      rel="noopener"
      className={`inline-flex items-center gap-1.5 text-[0.78rem] font-semibold leading-none opacity-85 hover:opacity-100 ${className}`}
    >
      <WoxMark />
      <span>
        {label} <span className="font-extrabold">{venue.poweredBy.label}</span>
      </span>
    </a>
  );
}

/** Switches between the two public landing pages. The language is in the URL there. */
export function SiteLangLink({ lang, path = "" }: { lang: Lang; path?: string }) {
  const other: Lang = lang === "ka" ? "en" : "ka";
  const href = other === "en" ? `/en${path}` : path || "/";
  return (
    <a href={href} hrefLang={other} lang={other} className="btn btn-line btn-small">
      {other === "en" ? "English" : "ქართული"}
    </a>
  );
}
