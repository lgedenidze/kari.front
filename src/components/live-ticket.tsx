"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/provider";
import { codeAt, formatToken, importKey, msUntilNextStep, stepAt, STEP_SECONDS } from "@/lib/pass-code";
import type { Ticket } from "@/lib/types";
import { Qr } from "./qr";
import { Stamp } from "./stamp";
import { StubCode, TicketCard } from "./ticket";

/**
 * A pass as its holder sees it. The QR is redrawn here, on the phone, every thirty seconds from
 * a key the API handed over once — so it keeps working with no signal in a basement.
 */
export function LiveTicket({
  ticket,
  serverTime,
  tonight,
}: {
  ticket: Ticket;
  /** The API's clock when it answered, in ms. Phones drift; codes must follow the server. */
  serverTime: number;
  /** Tonight, as the API sees it. Only a pass for tonight shows a code. */
  tonight: string;
}) {
  const { t, fill, night, time } = useI18n();
  const [token, setToken] = useState<string | null>(null);
  const [msLeft, setMsLeft] = useState(STEP_SECONDS * 1000);
  const offset = useRef(0);
  // Browsers only expose the crypto this needs on https (and localhost). Read on the client
  // only, so the server render and the first client render agree.
  const unsupported = !useSyncExternalStore(
    subscribeToNothing,
    () => Boolean(globalThis.crypto?.subtle),
    () => true,
  );

  const live = ticket.status === "active" && ticket.night === tonight;

  useEffect(() => {
    offset.current = serverTime - Date.now();
  }, [serverTime]);

  useEffect(() => {
    if (!live || unsupported) return;

    let cancelled = false;
    let lastStep = -1;
    let timer: ReturnType<typeof setInterval> | undefined;

    importKey(ticket.key).then((key) => {
      const tick = async () => {
        const now = Date.now() + offset.current;
        setMsLeft(msUntilNextStep(now));
        const step = stepAt(now);
        if (step === lastStep) return;
        lastStep = step;
        const code = await codeAt(key, step);
        if (!cancelled) setToken(formatToken(ticket.publicId, code));
      };
      void tick();
      timer = setInterval(tick, 250);
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [live, unsupported, ticket.key, ticket.publicId]);

  // Keep the screen awake while the pass is up: a phone that dims in the queue is a failed scan.
  useEffect(() => {
    if (!live || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = () => {
      navigator.wakeLock
        .request("screen")
        .then((sentinel) => (lock = sentinel))
        .catch(() => {});
    };
    acquire();
    const onVisible = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [live]);

  const kindLabel =
    ticket.kind === "guest" && ticket.inviterName
      ? fill(t.ticket.guestOf, { name: ticket.inviterName })
      : ticket.kind === "door"
        ? t.ticket.doorTicket
        : ticket.kind === "guest"
          ? t.status.guest
          : t.ticket.member;

  const nightLabel = ticket.nightTitle ? `${ticket.nightTitle}, ${night(ticket.night)}` : night(ticket.night);
  const admitted = ticket.admittedAt !== null;

  let window_: React.ReactNode;
  let caption: React.ReactNode;
  let stamp: React.ReactNode = null;

  if (ticket.status === "revoked") {
    window_ = <Message>{t.ticket.revoked}</Message>;
    stamp = <Stamp word={t.ticket.stampVoid} ink="red" size={118} tilt={-12} />;
  } else if (ticket.night < tonight) {
    window_ = <Message>{fill(t.ticket.wasFor, { date: night(ticket.night, "long") })}</Message>;
  } else if (ticket.night > tonight) {
    window_ = <Message>{fill(t.ticket.isFor, { date: night(ticket.night, "long") })}</Message>;
  } else if (unsupported) {
    window_ = <Message>{t.ticket.needsHttps}</Message>;
  } else {
    window_ = token ? (
      <Qr value={token} label={t.ticket.showAtDoor} className="block w-full" />
    ) : (
      <div className="aspect-square w-full animate-pulse rounded-lg bg-paper" aria-label={t.common.loading} />
    );
    caption = admitted ? (
      <>
        <p>{fill(t.ticket.insideSince, { time: time(ticket.admittedAt!) })}</p>
        <p className="font-normal text-paper-soft">{t.ticket.reentry}</p>
      </>
    ) : (
      <>
        <p>{t.ticket.showAtDoor}</p>
        <p className="tabular font-normal text-paper-soft" aria-live="off">
          {fill(t.ticket.newCodeIn, { s: Math.ceil(msLeft / 1000) })}
        </p>
      </>
    );
    // The stamp lands the moment the door lets them in: keyed on admittedAt so it plays once.
    if (admitted) stamp = <Stamp key={ticket.admittedAt} word={t.ticket.stampAdmitted} ink="green" size={118} thump />;
  }

  return (
    <TicketCard
      nightLabel={nightLabel}
      firstName={ticket.firstName}
      lastName={ticket.lastName}
      kindLabel={kindLabel}
      caption={caption}
      stamp={stamp}
      progress={live && !unsupported ? 1 - msLeft / (STEP_SECONDS * 1000) : undefined}
      stubLeft={<StubCode label={t.ticket.code} code={ticket.shortCode} />}
      poweredBy={t.common.poweredBy}
    >
      {window_}
    </TicketCard>
  );
}

const subscribeToNothing = () => () => {};

function Message({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex aspect-square w-full items-center justify-center text-center text-lg font-bold leading-snug">
      {children}
    </p>
  );
}
