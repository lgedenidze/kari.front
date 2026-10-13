"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Field, FormError } from "@/components/field";
import { LiveTicket } from "@/components/live-ticket";
import { TicketSkeleton } from "@/components/loading";
import { useMe, usePoll } from "@/components/me";
import { SaveToPhone } from "@/components/save-to-phone";
import { Stamp } from "@/components/stamp";
import { StubCode, TicketCard } from "@/components/ticket";
import { PassIcon } from "@/components/icons";
import { useLive } from "@/components/use-live";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import type { Me, NightInfo, TonightResponse } from "@/lib/types";
import { venue } from "@/venue";

/** The pass on its way: the one placeholder this screen has, here and in loading.tsx. */
export function PassSkeleton() {
  return (
    <div className="flex flex-1 flex-col items-center gap-6">
      <TicketSkeleton />
    </div>
  );
}

export function PassScreen({ first, week = null }: { first: TonightResponse | null; week?: NightInfo[] | null }) {
  const { t, fill, night } = useI18n();
  const { me, setMe, refresh } = useMe();
  // Asked again every few seconds: this is how the phone learns the door let them in. A failed
  // poll never wipes a pass that is already on screen — the last answer stays.
  const live = useLive<TonightResponse>("/pass/tonight", { every: 4000, first });
  const { data } = live;
  const [claimFailure, setClaimFailure] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const failure = claimFailure ?? live.failure;

  // While a request is in review, ask about the account too: that is how the bar's yes arrives.
  usePoll(refresh, 4000, me.status === "pending");

  async function claim() {
    setClaiming(true);
    setClaimFailure(null);
    try {
      live.set(await api.post<TonightResponse>("/pass/claim"));
    } catch (error) {
      setClaimFailure(isApiError(error) ? error.code : "server_error");
    }
    setClaiming(false);
  }

  if (!data) {
    return failure ? (
      <div className="paper p-5">
        <FormError code={failure} />
        <button type="button" className="btn btn-ink mt-4 w-full" onClick={() => void live.reload()}>
          {t.common.retry}
        </button>
      </div>
    ) : (
      <PassSkeleton />
    );
  }

  const { tonight, ticket } = data;
  const nightLabel = tonight.title ? `${tonight.title}, ${night(tonight.night)}` : night(tonight.night);
  // The first open night after this one, by the API's own dates.
  const nextOpen = week?.find((n) => n.open && n.night > tonight.night);

  return (
    <div className="flex flex-1 flex-col items-center gap-6">
      {ticket ? (
        <>
          <LiveTicket ticket={ticket} serverTime={data.serverTime} tonight={tonight.night} />
          <SaveToPhone image="/pass/ticket.png" fileName={`${venue.name.toLowerCase()}-${ticket.shortCode}`} />
        </>
      ) : me.status === "banned" ? (
        <StatusCard title={t.pass.bannedTitle} body={t.pass.bannedBody} stamp={<Stamp word={t.status.banned} ink="red" size={104} />} />
      ) : me.status === "pending" ? (
        <PendingCard me={me} onChanged={setMe} />
      ) : me.status === "rejected" ? (
        <ApplyCard
          title={t.pass.rejectedTitle}
          body={t.pass.rejectedBody}
          note={me.reviewNote}
          prompt={t.pass.reapply}
          submit={t.pass.reapplySubmit}
          current={me.facebookUrl}
          onDone={setMe}
        />
      ) : me.status === "guest" ? (
        <ApplyCard title={t.pass.guestTitle} body={t.pass.guestBody} prompt={null} submit={t.pass.apply} current={null} onDone={setMe} />
      ) : data.canClaim ? (
        // The pass before it is printed. It is already the ticket — the member's name, tonight,
        // the stub — with one thing missing: the code, and the button that prints it. A first
        // visit shows what they are about to hold, not a paragraph about it.
        <TicketCard
          nightLabel={nightLabel}
          firstName={me.firstName}
          lastName={me.lastName}
          kindLabel={t.ticket.member}
          caption={
            <>
              <p>{fill(t.landing.tonightOpen, { open: tonight.doorsOpen, close: tonight.doorsClose })}</p>
              {tonight.note && <p className="font-normal text-paper-soft">{tonight.note}</p>}
            </>
          }
          stubLeft={<StubCode label={t.ticket.code} code="– – –" />}
          poweredBy={t.common.poweredBy}
        >
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-5 rounded-xl border-[3px] border-dashed border-paper-line px-2 text-center">
            <PassIcon width={52} height={52} className="text-paper-soft" />
            <button type="button" className="btn btn-ink btn-big w-full" onClick={claim} disabled={claiming}>
              {claiming ? t.pass.claiming : t.pass.claim}
            </button>
          </div>
        </TicketCard>
      ) : (
        // Closed tonight: the same ticket, with nothing to print.
        <TicketCard
          nightLabel={nightLabel}
          firstName={me.firstName}
          lastName={me.lastName}
          kindLabel={t.ticket.member}
          stubLeft={<StubCode label={t.ticket.code} code="– – –" />}
          poweredBy={t.common.poweredBy}
        >
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border-[3px] border-dashed border-paper-line px-3 text-center">
            <p className="display text-3xl">{t.pass.closedTitle}</p>
            {tonight.note && <p className="text-sm text-paper-soft">{tonight.note}</p>}
            {/* Closed is not a dead end: say when to come back. */}
            {nextOpen && (
              <p className="mt-1 text-sm font-semibold">
                {fill(t.landing.nextOpen, { date: night(nextOpen.night, "long") })}
                {nextOpen.title && `, ${nextOpen.title}`}
              </p>
            )}
          </div>
        </TicketCard>
      )}

      {failure && (
        <div className="w-full">
          <FormError code={failure} />
        </div>
      )}

      {/* Someone still in review can hold a guest ticket; tell them where their own request stands. */}
      {ticket && me.status === "pending" && <p className="text-center text-sm text-ink-soft">{t.pass.pendingTitle}</p>}

      {me.pendingInvites > 0 && (
        <Link href="/invites" className="btn btn-paper w-full">
          {me.pendingInvites === 1 ? t.pass.invitesWaitingOne : fill(t.pass.invitesWaitingMany, { n: me.pendingInvites })}
        </Link>
      )}

      {data.upcoming.length > 0 && (
        <section className="w-full">
          <h2 className="text-xl text-paper">{t.pass.upcomingTitle}</h2>
          <ul className="mt-3 space-y-2">
            {data.upcoming.map((pass) => (
              <li key={pass.night} className="rounded-xl border-2 border-ink-line px-4 py-3">
                <p className="font-bold text-paper-light">
                  {night(pass.night, "long")}
                  {pass.nightTitle && `, ${pass.nightTitle}`}
                </p>
                <p className="text-sm text-ink-soft">
                  {pass.inviterName ? fill(t.ticket.guestOf, { name: pass.inviterName }) : t.ticket.member}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Nights so far, once there is one to count. */}
      {me.status === "approved" && me.visits > 0 && (
        <p className="mt-auto pt-2 text-center text-sm text-ink-soft">
          {me.visits === 1 ? t.pass.visitsOne : fill(t.pass.visitsMany, { n: me.visits })}
        </p>
      )}
    </div>
  );
}

function StatusCard({ title, body, stamp }: { title: string; body: string; stamp?: React.ReactNode }) {
  return (
    <div className="paper w-full p-6">
      {/* The stamp sits beside the title, whole — never cropped by the card's corner. */}
      <div className="flex items-start justify-between gap-2">
        <h1 className="min-w-0 text-[clamp(1.9rem,8.6vw,2.5rem)]">{title}</h1>
        {stamp && <div className="-mr-2 -mt-2 flex-none">{stamp}</div>}
      </div>
      <p className="mt-3 text-paper-soft">{body}</p>
    </div>
  );
}

/**
 * Waiting for the bar. The worst thing this screen can be is a dead end, so it says where the
 * request is, what comes next, and shows the link that was sent — with a way to fix it,
 * because a mistyped link is the usual reason a request sits unanswered.
 */
function PendingCard({ me, onChanged }: { me: Me; onChanged: (me: Me) => void }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <ApplyCard
        title={t.pass.changeLink}
        body={t.join.facebookHint}
        prompt={t.join.facebook}
        submit={t.common.save}
        current={me.facebookUrl}
        onDone={(updated) => {
          onChanged(updated);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const steps: [string, "done" | "now" | "next"][] = [
    [t.pass.stepSent, "done"],
    [t.pass.stepReview, "now"],
    [t.pass.stepPass, "next"],
  ];

  return (
    <div className="paper w-full p-6">
      <div className="flex items-start justify-between gap-2">
        <h1 className="min-w-0 text-[clamp(1.9rem,8.6vw,2.5rem)]">{t.pass.pendingTitle}</h1>
        <div className="-mr-2 -mt-2 flex-none">
          <Stamp word={t.ticket.stampReview} ink="grey" size={92} />
        </div>
      </div>

      <ol className="mt-5">
        {steps.map(([label, state], index) => (
          <li key={label} className="relative flex gap-3.5 pb-5 last:pb-0">
            {/* the line that joins one step to the next */}
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`absolute left-[0.6875rem] top-6 h-full w-0.5 ${state === "done" ? "bg-ink" : "bg-paper-line"}`}
              />
            )}
            <span
              aria-hidden="true"
              className={`relative z-10 grid h-6 w-6 flex-none place-items-center rounded-full border-2 ${
                state === "done" ? "border-ink bg-ink text-paper" : state === "now" ? "border-ink bg-paper" : "border-paper-line bg-paper"
              }`}
            >
              {state === "done" && (
                <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m2.5 6.4 2.3 2.3 4.7-5" />
                </svg>
              )}
              {state === "now" && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
            </span>
            <span className={state === "now" ? "font-bold" : state === "next" ? "text-paper-soft" : ""}>{label}</span>
          </li>
        ))}
      </ol>

      <p className="mt-5 text-sm text-paper-soft">{t.pass.pendingBody}</p>

      {me.facebookUrl && (
        <div className="mt-5 rounded-xl border-2 border-ink bg-qr px-4 py-3">
          <p className="text-sm font-bold">{t.pass.yourLink}</p>
          {/* A link, so the guest can see for themselves that it opens the right profile. */}
          <a href={me.facebookUrl} target="_blank" rel="noopener" className="link block truncate">
            {me.facebookUrl.replace("https://www.", "")}
          </a>
          <button type="button" className="link mt-1.5 text-sm" onClick={() => setEditing(true)}>
            {t.pass.changeLink}
          </button>
        </div>
      )}
    </div>
  );
}

/** Asks for membership with a Facebook link: the first time for a guest, again after a rejection. */
function ApplyCard({
  title,
  body,
  note,
  prompt,
  submit,
  current,
  onDone,
  onCancel,
}: {
  title: string;
  body: string;
  note?: string | null;
  prompt: string | null;
  submit: string;
  current: string | null;
  onDone: (me: Me) => void;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const facebookUrl = new FormData(event.currentTarget).get("facebookUrl");
    setBusy(true);
    setFieldError(undefined);
    setFailure(null);
    try {
      onDone(await api.post<Me>("/me/apply", { facebookUrl }));
    } catch (error) {
      if (isApiError(error) && error.fields.facebookUrl) setFieldError(error.fields.facebookUrl);
      else setFailure(isApiError(error) ? error.code : "server_error");
      setBusy(false);
    }
  }

  return (
    // Opened by a tap ("change the link") it rises; as the screen's first content it does not.
    <form onSubmit={apply} noValidate className={`paper w-full space-y-4 p-6 ${onCancel ? "rise" : ""}`}>
      <div>
        <h1 className="text-[clamp(1.9rem,8.6vw,2.5rem)]">{title}</h1>
        <p className="mt-3 text-paper-soft">{body}</p>
      </div>
      {note && (
        <p className="rounded-xl border-2 border-ink bg-qr px-4 py-3">
          <span className="block text-sm font-bold">{t.pass.rejectedNote}</span>
          {note}
        </p>
      )}
      <FormError code={failure} />
      <Field
        label={prompt ?? t.join.facebook}
        name="facebookUrl"
        type="url"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        defaultValue={current ?? ""}
        placeholder="facebook.com/your.name"
        required
        hint={t.join.facebookHint}
        error={fieldError}
      />
      <button type="submit" className="btn btn-ink w-full" disabled={busy}>
        {busy ? t.join.submitting : submit}
      </button>
      {onCancel && (
        <button type="button" className="btn w-full" onClick={onCancel}>
          {t.common.cancel}
        </button>
      )}
    </form>
  );
}
