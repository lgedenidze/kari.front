import type { SVGProps } from "react";

// The app's own icons, drawn in its vocabulary — tickets, tear lines, stamps — rather than
// taken from a general-purpose set. One weight (2px), round joins, on a 24px grid, so they sit
// with the heavy condensed type instead of looking borrowed.

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** The pass: a ticket with its notches, its tear line and the window where the QR sits. */
export function PassIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M7 2.5h10a2 2 0 0 1 2 2v9.4a1.9 1.9 0 0 0 0 3.7v1.9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-1.9a1.9 1.9 0 0 0 0-3.7V4.5a2 2 0 0 1 2-2Z" />
      <path d="M9 15.75h6" strokeDasharray="0.01 2.9" strokeWidth="2.2" />
      <rect x="9" y="6" width="6" height="6" rx="1.2" />
    </Icon>
  );
}

/** Invites: a ticket handed on — the same ticket, with a plus. */
export function InviteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12.5 5.5H5.5a2 2 0 0 0-2 2v6.6a1.9 1.9 0 0 1 0 3.7v1.7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1.7a1.9 1.9 0 0 1 0-3.7v-2.6" />
      <path d="M7.5 15.95h4" strokeDasharray="0.01 2.9" strokeWidth="2.2" />
      <path d="M18.5 2.5v7M15 6h7" />
    </Icon>
  );
}

/** Profile: a person inside a stamp ring. */
export function ProfileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="9.6" r="3.1" />
      <path d="M6.3 18.6c1.2-2.5 3.2-3.8 5.7-3.8s4.5 1.3 5.7 3.8" />
    </Icon>
  );
}

/** Scan: the four corners of a viewfinder around a code. */
export function ScanIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3.5 8V5.5a2 2 0 0 1 2-2H8M16 3.5h2.5a2 2 0 0 1 2 2V8M20.5 16v2.5a2 2 0 0 1-2 2H16M8 20.5H5.5a2 2 0 0 1-2-2V16" />
      <rect x="8.5" y="8.5" width="7" height="7" rx="1.2" />
    </Icon>
  );
}

/** The back office: a rubber stamp on its pad — where requests get approved. */
export function OfficeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M10 3h4a1 1 0 0 1 1 1v4.6c0 .6.3 1.2.8 1.6l1.9 1.5c.5.4.8 1 .8 1.6V15.5h-13v-2.2c0-.6.3-1.2.8-1.6l1.9-1.5c.5-.4.8-1 .8-1.6V4a1 1 0 0 1 1-1Z" />
      <path d="M4 20h16" />
    </Icon>
  );
}

/** Find: a magnifier. */
export function FindIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </Icon>
  );
}

/** Log: the door's ledger — rows, each with its mark. */
export function LogIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 6h11.5M9 12h11.5M9 18h11.5" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" strokeWidth="3" />
    </Icon>
  );
}
