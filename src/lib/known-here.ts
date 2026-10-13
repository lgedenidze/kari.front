// What this phone remembers about whoever holds it, for the public pages.
//
// The landing page is static: it is the same page for everyone, and it may not read a cookie.
// But most people who open it a second time are not strangers — they are a member who wants
// their pass, or a guest who wants the ticket they were given. Two small notes in the
// browser's own storage let the page offer that instead of "request access".
//
// Neither note is a credential. One says "someone signed in here"; the other is the address
// of a ticket this browser has already opened. The pass and the ticket are still guarded by
// the session and by the ticket's own link.

const MEMBER = "kari_member";
const TICKET = "kari_ticket";

const listeners = new Set<() => void>();

function write(action: (store: Storage) => void) {
  try {
    action(window.localStorage);
  } catch {
    // Private browsing, or storage switched off: the page simply stays as it is for a stranger.
  }
  listeners.forEach((listener) => listener());
}

/** A member is signed in on this phone. */
export function rememberMember(): void {
  write((store) => store.setItem(MEMBER, "1"));
}

/** They signed out, or deleted the account: this phone is a stranger's again. */
export function forgetMember(): void {
  write((store) => {
    store.removeItem(MEMBER);
    store.removeItem(TICKET);
  });
}

/** A guest's or a walk-in's ticket was opened here: where it is, and which night it is for. */
export function rememberTicket(href: string, night: string): void {
  write((store) => store.setItem(TICKET, JSON.stringify({ href, night })));
}

export interface Known {
  member: boolean;
  ticket: { href: string; night: string } | null;
}

/** What is remembered, as one string — so React can tell when it changed. */
export function knownSnapshot(): string {
  try {
    return `${window.localStorage.getItem(MEMBER) ?? ""}|${window.localStorage.getItem(TICKET) ?? ""}`;
  } catch {
    return "|";
  }
}

export function parseKnown(snapshot: string): Known {
  const cut = snapshot.indexOf("|");
  const member = snapshot.slice(0, cut) === "1";
  try {
    const ticket = JSON.parse(snapshot.slice(cut + 1) || "null") as Known["ticket"];
    // Only ever a page of this site, of the two kinds a ticket lives at.
    const ours = ticket && typeof ticket.night === "string" && /^\/(i|t)\/[\w-]+$/.test(ticket.href);
    return { member, ticket: ours ? ticket : null };
  } catch {
    return { member, ticket: null };
  }
}

export function watchKnown(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
