"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Field, FormError, useFirstMistake } from "@/components/field";
import { PassIcon } from "@/components/icons";
import { LiveTicket } from "@/components/live-ticket";
import { TicketSkeleton } from "@/components/loading";
import { SaveToPhone } from "@/components/save-to-phone";
import { StubCode, TicketCard } from "@/components/ticket";
import { useLive } from "@/components/use-live";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import { openFresh } from "@/lib/fresh-page";
import { rememberTicket } from "@/lib/known-here";
import type { Invite, InviteLinkResponse, Me } from "@/lib/types";
import { venue } from "@/venue";

export function InviteScreen({
  code,
  first,
  wallet = false,
  google = false,
}: {
  code: string;
  first: InviteLinkResponse | null;
  /** Whether this server can make an Apple Wallet pass, and offer one to Google Wallet. */
  wallet?: boolean;
  google?: boolean;
}) {
  const { t, fill, night } = useI18n();
  // Kept current: this is how the guest's phone learns the door let them in.
  const live = useLive<InviteLinkResponse>(`/invites/code/${encodeURIComponent(code)}`, { every: 5000, first });
  const { data, missing } = live;
  const [answerFailure, setAnswerFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const failure = answerFailure ?? live.failure;

  // A guest who holds this ticket finds it again from the landing page ("my ticket").
  const held = data && !data.viewerIsInviter && data.invite.status === "accepted" ? (data.ticket?.night ?? null) : null;
  useEffect(() => {
    if (held) rememberTicket(`/i/${code}`, held);
  }, [code, held]);

  async function answer(action: "accept" | "decline") {
    setBusy(true);
    setAnswerFailure(null);
    try {
      live.set(await api.post<InviteLinkResponse>(`/invites/code/${encodeURIComponent(code)}/${action}`));
    } catch (error) {
      setAnswerFailure(isApiError(error) ? error.code : "server_error");
    }
    setBusy(false);
  }

  if (missing) return <Notice title={t.inviteLink.notFoundTitle} body={t.inviteLink.notFoundBody} />;
  if (!data) {
    return failure ? (
      <div className="w-full">
        <FormError code={failure} />
      </div>
    ) : (
      <TicketSkeleton />
    );
  }

  const { invite } = data;
  const guestName = `${invite.guestFirstName} ${invite.guestLastName}`;
  const permanent = invite.kind === "permanent";
  const nightLabel = permanent
    ? t.inviteLink.memberLabel
    : invite.nightTitle
      ? `${invite.nightTitle}, ${night(invite.night)}`
      : night(invite.night);

  if (data.viewerIsInviter) {
    return (
      <Notice title={fill(t.inviteLink.inviterView, { name: guestName })} body={`${nightLabel}. ${stateWord(t, invite)}.`}>
        <Link href="/invites" className="btn btn-ink mt-5 w-full">
          {t.inviteLink.inviterManage}
        </Link>
      </Notice>
    );
  }

  if (invite.status === "declined") return <Notice title={t.inviteLink.declinedTitle} body={nightLabel} />;
  if (invite.status === "revoked") return <Notice title={t.inviteLink.revokedTitle} body={nightLabel} />;
  if (invite.status === "expired") return <Notice title={t.inviteLink.expiredTitle} body={nightLabel} />;

  if (permanent) return <MembershipInvite code={code} data={data} busy={busy} onDecline={() => answer("decline")} />;

  if (invite.status === "accepted" && data.ticket) {
    return (
      <div className="flex w-full flex-col items-center gap-5">
        <LiveTicket ticket={data.ticket} serverTime={data.serverTime} tonight={data.tonight} />
        <SaveToPhone
          image={`/i/${encodeURIComponent(code)}/ticket.png`}
          fileName={`${venue.name.toLowerCase()}-${data.ticket.shortCode}`}
          wallet={wallet ? `/i/${encodeURIComponent(code)}/wallet.pkpass` : undefined}
          google={google ? `/i/${encodeURIComponent(code)}/google-wallet` : undefined}
        />
        <p className="text-center text-sm text-ink-soft">{t.ticket.keepPage}</p>
        {failure && (
          <div className="w-full">
            <FormError code={failure} />
          </div>
        )}
        {!invite.admitted && <CantCome busy={busy} onDecline={() => answer("decline")} />}
      </div>
    );
  }

  // Pending: the invite already is the ticket it will become — the guest's name, the night —
  // with one thing missing: the code, and the button that prints it.
  // The same shape as a member's pass before it is claimed, so the two are learnt once.
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <h1 className="self-start text-4xl text-paper">{t.inviteLink.title}</h1>

      <TicketCard
        nightLabel={nightLabel}
        firstName={invite.guestFirstName}
        lastName={invite.guestLastName}
        kindLabel={t.status.guest}
        caption={
          <>
            {/* When to come: the guest has no other screen that says it. */}
            {data.night.open && <p>{fill(t.ticket.doors, { open: data.night.doorsOpen, close: data.night.doorsClose })}</p>}
            <p className="font-normal text-paper-soft">{t.inviteLink.idNote}</p>
          </>
        }
        stubLeft={
          invite.guestPersonalNumber ? <StubCode label={t.common.personalNumber} code={invite.guestPersonalNumber} /> : <span />
        }
        poweredBy={t.common.poweredBy}
      >
        <div className="flex aspect-square w-full flex-col items-center justify-center gap-5 rounded-xl border-[3px] border-dashed border-paper-line px-2 text-center">
          <PassIcon width={52} height={52} className="text-paper-soft" />
          <button type="button" className="btn btn-ink btn-big w-full" disabled={busy} onClick={() => answer("accept")}>
            {busy ? t.inviteLink.accepting : t.inviteLink.accept}
          </button>
        </div>
      </TicketCard>

      {failure && (
        <div className="w-full">
          <FormError code={failure} />
        </div>
      )}

      <CantCome busy={busy} onDecline={() => answer("decline")} />
    </div>
  );
}

/**
 * "I can't come" gives the ticket up for good — the invite cannot be accepted again — so it
 * is asked for twice, in place. It stays a quiet line until it is tapped.
 */
function CantCome({ busy, onDecline }: { busy: boolean; onDecline: () => void }) {
  const { t } = useI18n();
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" className="link px-3 py-2.5 text-sm text-ink-soft" disabled={busy} onClick={() => setAsking(true)}>
        {t.invites.cantCome}
      </button>
    );
  }

  return (
    <div className="rise w-full max-w-[22rem] rounded-2xl border-2 border-ink-line p-4 text-center">
      <p className="font-semibold text-paper-light">{t.invites.declineConfirm}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-stop flex-1" disabled={busy} onClick={onDecline}>
          {t.invites.decline}
        </button>
        <button type="button" className="btn btn-line flex-1 text-paper-light" disabled={busy} onClick={() => setAsking(false)}>
          {t.common.back}
        </button>
      </div>
    </div>
  );
}

function stateWord(t: ReturnType<typeof useI18n>["t"], invite: Invite): string {
  if (invite.admitted) return t.invites.stateAdmitted;
  if (invite.kind === "permanent" && invite.status === "accepted") return t.invites.stateMember;
  const status: string = invite.status;
  const words: Record<string, string> = {
    pending: t.invites.statePending,
    accepted: t.invites.stateAccepted,
    declined: t.invites.stateDeclined,
    revoked: t.invites.stateRevoked,
    expired: t.invites.stateExpired,
  };
  return words[status] ?? status;
}

/**
 * A permanent invite: the guest is asked to become a member, not handed a ticket. It is for
 * one phone number, and only the account with that number can take it. So the page asks
 * whoever opened it for exactly what they lack: someone with no account signs up here, with
 * that number; the right account accepts with one tap; any other account is told the invite
 * is not theirs. Once accepted, the member's pass is in the app, like any member's.
 */
function MembershipInvite({
  code,
  data,
  busy: declining,
  onDecline,
}: {
  code: string;
  data: InviteLinkResponse;
  busy: boolean;
  onDecline: () => void;
}) {
  const { t, fill } = useI18n();
  const { invite } = data;
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // The link shows the phone masked: it gets forwarded. Its last digits are enough to know it by.
  const digits = (invite.inviteePhone ?? "").slice(-3);

  if (invite.status === "accepted") {
    return data.viewerIsInvitee ? (
      <Notice title={t.inviteLink.memberNowTitle} body={t.inviteLink.memberNowBody}>
        <Link href="/pass" className="btn btn-ink mt-5 w-full">
          {t.inviteLink.openPass}
        </Link>
      </Notice>
    ) : (
      <Notice title={t.inviteLink.acceptedTitle} body={data.signedIn ? "" : t.inviteLink.signInToSee}>
        {!data.signedIn && (
          <Link href="/login?next=/pass" className="btn btn-ink mt-5 w-full">
            {t.common.signIn}
          </Link>
        )}
      </Notice>
    );
  }

  if (data.signedIn && !data.viewerIsInvitee) {
    return <Notice title={t.inviteLink.otherPhoneTitle} body={fill(t.inviteLink.otherPhoneBody, { digits })} />;
  }

  async function accept() {
    setBusy(true);
    setFailure(null);
    try {
      await api.post<InviteLinkResponse>(`/invites/code/${encodeURIComponent(code)}/accept`);
      // A whole new page: the account is a member now, and the dock and the pass follow it.
      openFresh("/pass");
    } catch (error) {
      setFailure(isApiError(error) ? error.code : "server_error");
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <h1 className="self-start text-4xl text-paper">{t.inviteLink.memberTitle}</h1>

      {/* The card it will become: the name, and for every night. */}
      <TicketCard
        nightLabel={t.inviteLink.memberLabel}
        firstName={invite.guestFirstName}
        lastName={invite.guestLastName}
        kindLabel={t.ticket.member}
        stubLeft={<span />}
        poweredBy={t.common.poweredBy}
      >
        <div className="flex aspect-square w-full flex-col items-center justify-center gap-5 rounded-xl border-[3px] border-dashed border-paper-line px-4 text-center">
          <PassIcon width={52} height={52} className="text-paper-soft" />
          {data.viewerIsInvitee ? (
            <button type="button" className="btn btn-ink btn-big w-full" disabled={busy || declining} onClick={accept}>
              {busy ? t.inviteLink.becoming : t.inviteLink.become}
            </button>
          ) : (
            <p className="font-semibold text-paper-soft">{t.inviteLink.memberCaption}</p>
          )}
        </div>
      </TicketCard>

      {failure && (
        <div className="w-full">
          <FormError code={failure} />
        </div>
      )}

      {!data.signedIn && <JoinFromInvite code={code} invite={invite} digits={digits} />}

      <CantCome busy={busy || declining} onDecline={onDecline} />
    </div>
  );
}

/**
 * Signing up from a permanent invite. The name is the invite's — the one the member vouched
 * for — so it is not asked for. The API makes the account and the membership together, or
 * neither: a number that is not the invited one leaves no account behind.
 */
function JoinFromInvite({ code, invite, digits }: { code: string; invite: Invite; digits: string }) {
  const { t, fill, lang, error: errorText } = useI18n();
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  useFirstMistake(form, fields);
  const signIn = `/login?next=${encodeURIComponent(`/i/${code}`)}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sent = new FormData(event.currentTarget);
    setBusy(true);
    setFields({});
    setFailure(null);
    try {
      await api.post<Me>("/auth/register", {
        inviteCode: code,
        firstName: invite.guestFirstName,
        lastName: invite.guestLastName,
        phone: sent.get("phone"),
        password: sent.get("password"),
        lang,
        adult,
        consent,
      });
      openFresh("/pass");
    } catch (error) {
      if (isApiError(error)) {
        setFields(error.fields);
        setFailure(Object.keys(error.fields).length > 0 ? "validation" : error.code);
      } else {
        setFailure("server_error");
      }
      setBusy(false);
    }
  }

  return (
    <form ref={form} onSubmit={submit} noValidate className="paper w-full space-y-4 p-5" aria-labelledby="join-from-invite">
      <h2 id="join-from-invite" className="text-2xl">
        {t.inviteLink.signUpTitle}
      </h2>

      <FormError code={failure} />

      <div>
        <Field
          label={t.common.phone}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="555 12 34 56"
          required
          hint={fill(t.inviteLink.sentTo, { digits })}
          error={fields.phone}
        />
        {/* "This number already has an account" comes with the way in — back to this invite. */}
        {fields.phone === "phone_taken" && (
          <Link href={signIn} className="btn btn-line btn-small mt-2">
            {t.common.signIn}
          </Link>
        )}
      </div>

      <Field
        label={t.common.password}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint={t.join.passwordHint}
        error={fields.password}
      />

      <div className="space-y-3 pt-1">
        <label className="check">
          <input
            type="checkbox"
            checked={adult}
            onChange={(event) => setAdult(event.target.checked)}
            aria-invalid={fields.adult ? true : undefined}
          />
          <span>
            {fill(t.join.adult, { age: venue.minimumAge })}
            {fields.adult && <span className="field-error block">{errorText(fields.adult)}</span>}
          </span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            aria-invalid={fields.consent ? true : undefined}
          />
          <span>
            {t.join.consent}{" "}
            <Link href={lang === "en" ? "/en/privacy" : "/privacy"} target="_blank" className="link">
              {t.common.privacy}
            </Link>
            {fields.consent && <span className="field-error block">{errorText(fields.consent)}</span>}
          </span>
        </label>
      </div>

      <button type="submit" className="btn btn-ink btn-big w-full" disabled={busy}>
        {busy ? t.inviteLink.becoming : t.inviteLink.become}
      </button>

      <Link href={signIn} className="link flex min-h-11 items-center justify-center text-sm">
        {t.inviteLink.haveAccount}
      </Link>
    </form>
  );
}

function Notice({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="paper w-full p-6">
      <h1 className="text-3xl">{title}</h1>
      <p className="mt-3 text-paper-soft">{body}</p>
      {children}
    </div>
  );
}
