import { useId } from "react";
import { venue } from "@/venue";

type StampInk = "blue" | "green" | "red" | "grey" | "paper";

const INK: Record<StampInk, string> = {
  blue: "var(--color-stamp-blue)",
  green: "var(--color-stamp-green)",
  red: "var(--color-stamp-red)",
  grey: "var(--color-paper-soft)",
  paper: "var(--color-paper)",
};

/**
 * A round door stamp. Every status in the product is one of these: verified, admitted, denied.
 * The ring carries the venue's name in both scripts; the band carries the word.
 */
export function Stamp({
  word,
  ring,
  ink = "blue",
  size = 132,
  tilt = -9,
  thump = false,
  onInk = false,
  className = "",
}: {
  word: string;
  /** Text around the ring. Defaults to the venue's name in both scripts. */
  ring?: string;
  ink?: StampInk;
  size?: number;
  tilt?: number;
  /** Play the landing animation once. */
  thump?: boolean;
  /** The stamp sits on the dark ground rather than on paper. */
  onInk?: boolean;
  className?: string;
}) {
  const id = useId();
  const ringText = ring ?? `${venue.name} ✦ ${venue.nameKa} ✦ ${venue.city.en.toUpperCase()} ✦ ${venue.city.ka} ✦ `;

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={word}
      className={`stamp ${onInk ? "stamp-on-ink" : ""} ${thump ? "stamp-thump" : ""} ${className}`}
      style={{ ["--tilt" as string]: `${tilt}deg`, color: INK[ink] }}
    >
      <defs>
        <path id={`${id}-ring`} d="M100,100 m-79,0 a79,79 0 1,1 158,0 a79,79 0 1,1 -158,0" />
        {/* Uneven ink: a little wobble on the edges and a few dry specks. */}
        <filter id={`${id}-ink`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="wobble" />
          <feDisplacementMap in="SourceGraphic" in2="wobble" scale="2.2" result="worn" />
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="3" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.55" result="specks" />
          <feComposite in="worn" in2="specks" operator="in" />
        </filter>
        {/* The rings stop where the band crosses them, so the word sits on clean ground. */}
        <mask id={`${id}-rings`}>
          <rect width="200" height="200" fill="white" />
          <rect x="10" y="72" width="180" height="56" fill="black" />
        </mask>
      </defs>

      <g filter={`url(#${id}-ink)`} fill="none" stroke="currentColor">
        <g mask={`url(#${id}-rings)`}>
          <circle cx="100" cy="100" r="95" strokeWidth="6" />
          <circle cx="100" cy="100" r="63" strokeWidth="3" />
          <text fill="currentColor" stroke="none" fontSize="15.5" fontWeight="800" style={{ fontVariationSettings: '"wdth" 80' }}>
            <textPath href={`#${id}-ring`} textLength="490" lengthAdjust="spacingAndGlyphs">
              {ringText}
            </textPath>
          </text>
        </g>
        {/* the band across the middle */}
        <rect x="14" y="76" width="172" height="48" rx="6" strokeWidth="4" />
        <text
          x="100"
          y="110"
          textAnchor="middle"
          fill="currentColor"
          stroke="none"
          fontSize="29"
          fontWeight="800"
          textLength={word.length > 8 ? 156 : undefined}
          lengthAdjust="spacingAndGlyphs"
          style={{ fontVariationSettings: '"wdth" 68', letterSpacing: word.length > 8 ? undefined : "0.06em" }}
        >
          {word}
        </text>
      </g>
    </svg>
  );
}
