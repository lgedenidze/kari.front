import type { ReactNode } from "react";
import { VenueMark, WoxCredit } from "./brand";

/**
 * The paper ticket. Used for the live pass, for the sample on the landing page and for an
 * invite before it is accepted — so every one of them looks like the thing it becomes.
 */
export function TicketCard({
  nightLabel,
  firstName,
  lastName,
  kindLabel,
  children,
  caption,
  stubLeft,
  poweredBy,
  stamp,
  progress,
  className = "",
}: {
  nightLabel: string;
  firstName: string;
  lastName: string;
  kindLabel: string;
  /** The window in the middle: a QR, or a message when there is no code to show. */
  children: ReactNode;
  caption?: ReactNode;
  stubLeft: ReactNode;
  poweredBy: string;
  stamp?: ReactNode;
  /** 0–1: how far through the thirty seconds the current code is. Drawn along the tear line. */
  progress?: number;
  className?: string;
}) {
  return (
    <article className={`ticket w-full max-w-[22rem] ${className}`}>
      <div className="px-5 pt-5 pb-4">
        <header className="flex items-start justify-between gap-3">
          <VenueMark className="text-[0.82rem]" />
          <p className="text-right text-sm font-bold leading-tight">{nightLabel}</p>
        </header>

        {/* The stamp lands beside the name — never on the QR, where it would break the scan. */}
        <div className="relative mt-4 min-w-0">
          <p className="display text-[2.1rem] break-words">
            {firstName}
            <br />
            {lastName}
          </p>
          <p className="mt-2 text-sm font-semibold text-paper-soft">{kindLabel}</p>
          {stamp && <div className="absolute -right-3 -top-5">{stamp}</div>}
        </div>

        <div className="mt-4 rounded-2xl bg-qr p-[9%] text-ink-deep">{children}</div>

        {caption && <div className="mt-3 min-h-[2.75rem] text-sm font-semibold">{caption}</div>}
      </div>

      <div className="ticket-tear" aria-hidden="true">
        {progress !== undefined && <span className="ticket-tear-progress" style={{ width: `${progress * 100}%` }} />}
      </div>

      <footer className="flex items-end justify-between gap-3 px-5 pb-4 pt-3.5">
        <div className="min-w-0">{stubLeft}</div>
        <WoxCredit label={poweredBy} className="shrink-0 text-ink" />
      </footer>
    </article>
  );
}

/** The label-and-code pair on a ticket stub. */
export function StubCode({ label, code }: { label: string; code: string }) {
  return (
    <p className="leading-tight">
      <span className="block text-[0.72rem] font-semibold text-paper-soft">{label}</span>
      <span className="code text-lg">{code}</span>
    </p>
  );
}
