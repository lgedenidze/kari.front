"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { VenueMark, WoxCredit } from "@/components/brand";
import { Face } from "@/components/face";
import { Field, FormError } from "@/components/field";
import { FindIcon, LogIcon, ScanIcon } from "@/components/icons";
import { useMe } from "@/components/me";
import { Qr } from "@/components/qr";
import { Stamp } from "@/components/stamp";
import { useLive } from "@/components/use-live";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import { networkOf } from "@/lib/profile-link";
import { savedTicketCode } from "@/lib/saved-ticket";
import type { DecideResponse, Decision, DoorTonight, Entry, ScanResult, SearchHit, Verdict, WalkInResponse } from "@/lib/types";
import { Scanner, ScannerStarting } from "./scanner";

type Tab = "scan" | "find" | "log";
type Tone = "go" | "wait" | "stop";

// What the band at the top of a result says before anyone reads a word.
const TONE: Record<Verdict, Tone> = {
  ok: "go",
  reentry: "wait",
  stale: "wait",
  no_pass: "wait",
  wrong_night: "stop",
  revoked: "stop",
  banned: "stop",
  unknown: "stop",
  not_on_list: "stop",
};

const BAND: Record<Tone, string> = {
  go: "bg-go text-ink-deep",
  wait: "bg-wait text-ink-deep",
  stop: "bg-stop text-ink-deep",
};

/**
 * The frame of the door: who is on it, the three counters, the three tabs. It needs nothing
 * from the server to be drawn — a counter with no number yet shows a dash — so it is on screen
 * from the tap, and is the same frame whether the page has arrived or not.
 */
function DoorFrame({
  tonight,
  tab,
  onTab,
  children,
}: {
  tonight: DoorTonight | null;
  tab: Tab;
  onTab?: (tab: Tab) => void;
  children: ReactNode;
}) {
  const { t, fill } = useI18n();
  const { me } = useMe();
  const capacity = tonight?.night.capacity;

  return (
    <div className="ground-deep flex flex-1 flex-col bg-ink-deep">
      <header className="flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link href="/pass" aria-label={t.pass.title}>
          <VenueMark className="text-[0.9rem]" />
        </Link>
        <p className="truncate text-sm text-ink-soft">
          {me.firstName} {me.lastName}
        </p>
      </header>

      <dl className="grid grid-cols-3 gap-2 px-4 pt-4 text-center">
        <Counter label={t.door.inside} value={tonight?.inside} note={capacity ? fill(t.door.ofCapacity, { n: capacity }) : undefined} />
        <Counter label={t.door.passesTonight} value={tonight?.passes} />
        <Counter label={t.door.turnedAway} value={tonight?.denied} />
      </dl>

      <nav className="mt-4 grid grid-cols-3 gap-1 px-4" aria-label={t.door.title}>
        {(
          [
            ["scan", t.door.tabScan, ScanIcon],
            ["find", t.door.tabFind, FindIcon],
            ["log", t.door.tabLog, LogIcon],
          ] as const
        ).map(([key, label, TabIcon]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => onTab?.(key)}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-full text-[0.95rem] font-bold transition-colors ${
              tab === key ? "bg-paper text-ink-deep" : "text-ink-soft hover:text-paper-light"
            }`}
          >
            <TabIcon width={20} height={20} />
            {label}
          </button>
        ))}
      </nav>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-4">{children}</main>

      <footer className="flex justify-center pb-2">
        <WoxCredit label={t.common.poweredBy} className="text-ink-soft" />
      </footer>
    </div>
  );
}

/** The door while its page is on the way: the frame, and the scanner window waiting. */
export function DoorSkeleton() {
  const { t } = useI18n();
  return (
    <DoorFrame tonight={null} tab="scan">
      <ScannerStarting />
      <p className="py-3 text-center font-semibold text-paper-light">{t.door.pointCamera}</p>
      <button type="button" className="btn btn-line mt-auto w-full text-paper-light">
        {t.door.walkIn}
      </button>
    </DoorFrame>
  );
}

export function DoorScreen({ first }: { first: DoorTonight | null }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("scan");
  // The counters are a convenience: the scanner must keep working without them, so a poll
  // that fails says nothing.
  const { data: tonight, set: setTonight } = useLive<DoorTonight>("/door/tonight", { every: 6000, first });
  const [result, setResult] = useState<ScanResult | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [flash, setFlash] = useState<Decision | null>(null);
  // A code has been read and the server has not answered yet.
  const [checking, setChecking] = useState(false);
  // A QR that is not one of ours gets a brief notice, not a full-screen result: there is
  // nobody to decide about, so nothing should have to be dismissed.
  const [notPass, setNotPass] = useState(false);
  // False once the camera is blocked or missing: "point the camera" is then the wrong advice.
  const [camera, setCamera] = useState(true);
  const busy = useRef(false);

  const onToken = useCallback(async (token: string) => {
    if (busy.current) return;
    busy.current = true;
    setFailure(null);
    setNotPass(false);
    // Say "read it" the instant the camera does — before the answer is back.
    setChecking(true);
    navigator.vibrate?.(35);
    try {
      // A ticket saved as a picture: its QR is not a pass code, but it names the pass. Look
      // the guest up by that, exactly as if staff had typed the short code into Find.
      const saved = savedTicketCode(token);
      if (saved) {
        const hits = await api.get<SearchHit[]>(`/door/search?q=${encodeURIComponent(saved)}`);
        const hit = hits.find((found) => found.passId);
        if (hit) {
          navigator.vibrate?.([90, 70, 90]);
          setResult(await api.get<ScanResult>(`/door/pass/${hit.passId}`));
          setChecking(false);
          busy.current = false;
          return;
        }
      }
      const scanned = await api.post<ScanResult>("/door/scan", { token });
      if (scanned.verdict === "unknown") {
        navigator.vibrate?.([90, 70, 90]);
        setNotPass(true);
        setTimeout(() => setNotPass(false), 2800);
      } else {
        navigator.vibrate?.(TONE[scanned.verdict] === "go" ? 70 : [90, 70, 90]);
        setResult(scanned);
      }
    } catch (error) {
      setFailure(isApiError(error) ? error.code : "server_error");
    }
    setChecking(false);
    busy.current = false;
  }, []);

  async function open(hit: { passId: string | null; userId: string | null }) {
    setFailure(null);
    try {
      setResult(await api.get<ScanResult>(hit.passId ? `/door/pass/${hit.passId}` : `/door/person/${hit.userId}`));
    } catch (error) {
      setFailure(isApiError(error) ? error.code : "server_error");
    }
  }

  function decided(response: DecideResponse) {
    setTonight(response.tonight);
    setResult(null);
    // The stamp is the receipt: one beat on screen, then straight back to the next guest.
    setFlash(response.entry.decision);
    setTimeout(() => setFlash(null), 1100);
  }

  return (
    <>
      <DoorFrame tonight={tonight} tab={tab} onTab={setTab}>
        {failure && <FormError code={failure} />}

        {tab === "scan" && (
          <>
            {/* The camera stays on but reads nothing while a result is up, so it is ready again
                at once. When it wakes, the pass just decided must leave the frame before it
                can be read again — see lib/scan-presence.ts. */}
            <Scanner
              active={!result && !walkIn && !flash && !checking}
              checking={checking}
              onToken={onToken}
              onCamera={setCamera}
              onFind={() => setTab("find")}
            />
            {notPass ? (
              <p role="status" className="rounded-2xl bg-stop px-4 py-3 text-center font-bold text-ink-deep">
                {t.verdict.unknown}. <span className="font-semibold">{t.verdict.unknownHint}</span>
              </p>
            ) : (
              camera && <p className="py-3 text-center font-semibold text-paper-light">{t.door.pointCamera}</p>
            )}
            <button type="button" className="btn btn-line mt-auto w-full text-paper-light" onClick={() => setWalkIn(true)}>
              {t.door.walkIn}
            </button>
          </>
        )}

        {tab === "find" && <Finder onOpen={open} onWalkIn={() => setWalkIn(true)} />}

        {tab === "log" && <Log entries={tonight?.recent ?? []} onOpen={open} />}
      </DoorFrame>

      {result && <ResultSheet result={result} onClose={() => setResult(null)} onDecided={decided} />}
      {walkIn && (
        <WalkInSheet
          onClose={() => setWalkIn(false)}
          onIssued={(response) => setTonight(response.tonight)}
        />
      )}

      {flash && (
        <div className="pointer-events-none fixed inset-0 z-30 grid place-items-center bg-ink-deep/80" role="status">
          <Stamp
            word={flash === "admitted" ? t.ticket.stampAdmitted : t.ticket.stampDenied}
            ink="paper"
            size={230}
            thump
            onInk
            className={flash === "admitted" ? "!text-go" : "!text-stop"}
          />
        </div>
      )}
    </>
  );
}

function Counter({ label, value, note }: { label: string; value: number | undefined; note?: string }) {
  return (
    <div className="rounded-2xl bg-ink px-2 py-2.5">
      <dt className="text-xs font-semibold text-ink-soft">{label}</dt>
      <dd className="display tabular text-3xl text-paper">
        {value ?? "–"}
        {note && <span className="ml-1 text-xs font-semibold tracking-normal text-ink-soft">{note}</span>}
      </dd>
    </div>
  );
}

/* ---------- the result: who this is, what the scanner thinks, and the two buttons ---------- */

function ResultSheet({
  result,
  onClose,
  onDecided,
}: {
  result: ScanResult;
  onClose: () => void;
  onDecided: (response: DecideResponse) => void;
}) {
  const { t, fill, night, time } = useI18n();
  const [denying, setDenying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const { verdict, person, pass, inviter, warnings } = result;
  const tone = TONE[verdict];

  // Esc closes: a keyboard-attached tablet at the door is a real setup.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function decide(decision: Decision, reason?: string) {
    setBusy(true);
    setFailure(null);
    try {
      onDecided(
        await api.post<DecideResponse>("/door/decide", {
          passId: pass?.id ?? null,
          userId: pass ? null : person?.userId,
          decision,
          reason,
          verdict,
          method: result.method,
        }),
      );
    } catch (error) {
      setFailure(isApiError(error) ? error.code : "server_error");
      setBusy(false);
    }
  }

  const hints: Record<Verdict, string> = {
    ok: t.verdict.okHint,
    reentry: fill(t.verdict.reentryHint, { time: pass?.admittedAt ? time(pass.admittedAt) : "" }),
    stale: t.verdict.staleHint,
    wrong_night: fill(t.verdict.wrong_nightHint, { date: pass ? night(pass.night, "long") : "" }),
    revoked: t.verdict.revokedHint,
    banned: t.verdict.bannedHint,
    unknown: t.verdict.unknownHint,
    no_pass: t.verdict.no_passHint,
    not_on_list: t.verdict.not_on_listHint,
  };

  const reasons = [t.door.reasonId, t.door.reasonDrunk, t.door.reasonDress, t.door.reasonFull, t.door.reasonBehaviour, t.door.reasonOther];

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-ink-deep" role="dialog" aria-modal="true" aria-label={t.verdict[verdict]}>
      <div className={`${BAND[tone]} px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))]`}>
        <h2 className="text-[2.6rem]">{t.verdict[verdict]}</h2>
        <p className="mt-1 text-lg font-semibold">{hints[verdict]}</p>
      </div>

      <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-4 py-4">
        {warnings.length > 0 && (
          <ul className="mb-4 space-y-2">
            {warnings.map((warning) => (
              <li key={warning} className="rounded-xl bg-wait px-4 py-3 font-bold text-ink-deep">
                {t.warning[warning]}
              </li>
            ))}
          </ul>
        )}

        {failure && (
          <div className="mb-4">
            <FormError code={failure} />
          </div>
        )}

        {person && (
          <article className="paper p-5">
            <div className="flex items-start gap-4">
              {person.hasPhoto && person.userId && (
                <Face userId={person.userId} className="h-24 w-24 flex-none rounded-2xl border-2 border-ink object-cover" />
              )}
              <div className="min-w-0">
                <p className="display break-words text-[2.3rem]">
                  {person.firstName}
                  <br />
                  {person.lastName}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="chip">{t.status[person.status]}</span>
              {pass && <span className="chip code !tracking-[0.1em]">{pass.shortCode}</span>}
              <span className="chip">
                {person.visits === 0 ? t.door.firstTime : fill(t.door.nights, { n: person.visits })}
              </span>
            </div>

            {person.personalNumber && (
              <div className="mt-4 rounded-xl border-2 border-ink bg-qr px-4 py-3">
                <p className="text-sm font-bold">{t.door.checkId}</p>
                <p className="code text-2xl">{person.personalNumber}</p>
              </div>
            )}

            <dl className="mt-4 space-y-1.5 text-[0.95rem]">
              {inviter && (
                <div>
                  <dt className="sr-only">{t.door.guestOf}</dt>
                  <dd className="font-bold">
                    {fill(t.door.guestOf, { name: inviter.name })}
                    {inviter.status !== "approved" && <span className="chip ml-2 text-stamp-red">{t.status[inviter.status]}</span>}
                  </dd>
                </div>
              )}
              {person.lastVisit && <dd className="text-paper-soft">{fill(t.door.lastHere, { date: night(person.lastVisit) })}</dd>}
              {person.denials > 0 && (
                <dd className="font-bold text-stamp-red">{fill(t.door.deniedBefore, { n: person.denials })}</dd>
              )}
              {person.phone && <dd className="tabular text-paper-soft">{person.phone}</dd>}
            </dl>

            {person.staffNotes && (
              <p className="mt-4 rounded-xl border-2 border-ink px-4 py-3">
                <span className="block text-sm font-bold">{t.door.notes}</span>
                {person.staffNotes}
              </p>
            )}

            {person.profileUrl && (
              <a href={person.profileUrl} target="_blank" rel="noopener" className="btn btn-line btn-small mt-4">
                {fill(t.common.openProfile, { platform: networkOf(person.profileUrl) })}
              </a>
            )}
          </article>
        )}
      </div>

      <div className="mx-auto w-full max-w-md px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        {!person ? (
          <button type="button" className="btn btn-paper btn-big w-full" onClick={onClose}>
            {t.door.scanAgain}
          </button>
        ) : denying ? (
          <div>
            <p className="mb-2 font-bold text-paper-light">{t.door.denyTitle}</p>
            <div className="grid grid-cols-2 gap-2">
              {reasons.map((reason) => (
                <button key={reason} type="button" className="btn btn-stop" disabled={busy} onClick={() => decide("denied", reason)}>
                  {reason}
                </button>
              ))}
            </div>
            <button type="button" className="btn mt-2 w-full text-paper-light" onClick={() => setDenying(false)}>
              {t.common.back}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {/* Both answers are always one tap, in the same place. What the scanner advises
                  is the filled one; the answer against its advice is an outline. On a "wait"
                  it has no advice, and both are filled. */}
              <button
                type="button"
                className={`btn btn-big ${tone === "go" ? "btn-line text-stop" : "btn-stop"}`}
                disabled={busy}
                onClick={() => setDenying(true)}
              >
                {t.door.deny}
              </button>
              <button
                type="button"
                className={`btn btn-big ${tone === "stop" ? "btn-line text-go" : "btn-go"}`}
                disabled={busy}
                onClick={() => decide("admitted")}
              >
                {t.door.admit}
              </button>
            </div>
            <button type="button" className="btn mt-1 w-full text-ink-soft" onClick={onClose}>
              {t.common.cancel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- find someone whose phone is dead ---------- */

function Finder({ onOpen, onWalkIn }: { onOpen: (hit: SearchHit) => void; onWalkIn: () => void }) {
  const { t, fill } = useI18n();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<SearchHit[] | null>(null);
  const term = query.trim();
  // Under two characters there is nothing to show, whatever the last search returned.
  const hits = term.length < 2 ? null : found;

  useEffect(() => {
    if (term.length < 2) return;
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const results = await api.get<SearchHit[]>(`/door/search?q=${encodeURIComponent(term)}`);
        if (!stale) setFound(results);
      } catch {
        if (!stale) setFound([]);
      }
    }, 220);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [term]);

  return (
    <>
      <label className="block">
        <span className="sr-only">{t.door.search}</span>
        <input
          type="search"
          className="input"
          placeholder={t.door.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
        />
      </label>

      {hits === null ? (
        <p className="text-center text-ink-soft">{t.door.searchHint}</p>
      ) : hits.length === 0 ? (
        <p className="text-center text-ink-soft">{t.door.noResults}</p>
      ) : (
        <ul className="space-y-2">
          {hits.map((hit) => {
            const detail = hit.detail?.startsWith("guest_of:")
              ? fill(t.door.guestOf, { name: hit.detail.slice("guest_of:".length) })
              : hit.detail === "member"
                ? t.ticket.member
                : hit.detail === "door"
                  ? t.ticket.doorTicket
                  : hit.detail === "guest"
                    ? t.status.guest
                    : hit.detail;
            const standing = hit.admitted ? t.door.inside : t.status[hit.status];
            return (
              <li key={hit.passId ?? hit.userId}>
                <button
                  type="button"
                  onClick={() => onOpen(hit)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-left transition-colors hover:bg-ink-raised active:bg-ink-raised"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-lg font-bold text-paper-light">{hit.name}</span>
                    <span className="block truncate text-sm text-ink-soft">{detail}</span>
                  </span>
                  {/* Where they stand — unless the line under the name has just said the same word. */}
                  {standing !== detail && (
                    <span
                      className={`chip flex-none ${
                        hit.admitted ? "text-go" : hit.status === "banned" || hit.status === "revoked" ? "text-stop" : "text-paper-light"
                      }`}
                    >
                      {standing}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" className="btn btn-line mt-auto w-full text-paper-light" onClick={onWalkIn}>
        {t.door.walkIn}
      </button>
    </>
  );
}

/**
 * Tonight's list: everyone the door has decided about, the latest first. A row opens that
 * person again — to look at who it was, or to decide again. Nothing in the list is ever
 * changed: a second answer is a second record.
 */
function Log({ entries, onOpen }: { entries: Entry[]; onOpen: (entry: Entry) => void }) {
  const { t, time } = useI18n();
  if (entries.length === 0) return <p className="pt-6 text-center text-ink-soft">{t.door.logEmpty}</p>;

  return (
    <ul className="space-y-2">
      {entries.map((entry) => (
        <li key={entry.id}>
          <button
            type="button"
            // A record of someone the door cannot look up again has nothing to open.
            disabled={!entry.passId && !entry.userId}
            onClick={() => onOpen(entry)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-left transition-colors hover:bg-ink-raised active:bg-ink-raised"
          >
            <span className="min-w-0">
              <span className="block truncate font-bold text-paper-light">{entry.personName}</span>
              <span className="block truncate text-sm text-ink-soft">
                <span className="tabular">{time(entry.createdAt)}</span>
                {entry.method === "manual" && `, ${t.door.byHand}`}
                {entry.reason && `, ${entry.reason}`}
              </span>
            </span>
            <span className={`chip flex-none ${entry.decision === "admitted" ? "text-go" : "text-stop"}`}>
              {entry.decision === "admitted" ? t.door.admitted : t.door.denied}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ---------- a ticket written at the door ---------- */

function WalkInSheet({ onClose, onIssued }: { onClose: () => void; onIssued: (response: WalkInResponse) => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [issued, setIssued] = useState<WalkInResponse | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFields({});
    setFailure(null);
    try {
      const response = await api.post<WalkInResponse>("/door/walk-in", {
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        personalNumber: form.get("personalNumber"),
      });
      onIssued(response);
      setIssued(response);
    } catch (error) {
      if (isApiError(error) && Object.keys(error.fields).length > 0) setFields(error.fields);
      else setFailure(isApiError(error) ? error.code : "server_error");
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-20 overflow-y-auto bg-ink-deep" role="dialog" aria-modal="true" aria-label={t.door.walkIn}>
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-6">
        {issued ? (
          <div className="paper rise space-y-4 p-6 text-center">
            <h2 className="text-4xl">{t.door.walkInDone}</h2>
            <p className="display text-2xl">{issued.entry.personName}</p>
            {/* The guest photographs this with their own phone and walks away holding a ticket. */}
            <div className="mx-auto w-56 rounded-2xl bg-qr p-5 text-ink-deep">
              <Qr value={`${window.location.origin}/t/${issued.ticketToken}`} label={t.door.walkInScan} className="block w-full" />
            </div>
            <p className="text-paper-soft">{t.door.walkInScan}</p>
            <p className="code text-xl">{issued.pass.shortCode}</p>
            <button type="button" className="btn btn-ink btn-big w-full" onClick={onClose}>
              {t.door.nextGuest}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="paper rise space-y-4 p-6">
            <h2 className="text-4xl">{t.door.walkIn}</h2>
            <FormError code={failure} />
            <div className="grid grid-cols-2 gap-3">
              <Field label={t.common.firstName} name="firstName" autoComplete="off" required autoFocus error={fields.firstName} />
              <Field label={t.common.lastName} name="lastName" autoComplete="off" required error={fields.lastName} />
            </div>
            <Field
              label={t.common.personalNumber}
              name="personalNumber"
              autoComplete="off"
              autoCapitalize="characters"
              optional
              error={fields.personalNumber}
            />
            <button type="submit" className="btn btn-go btn-big w-full" disabled={busy}>
              {t.door.walkInSubmit}
            </button>
            <button type="button" className="btn w-full" onClick={onClose}>
              {t.common.cancel}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
