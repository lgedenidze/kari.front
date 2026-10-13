"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FormError } from "@/components/field";
import { PassIcon } from "@/components/icons";
import { LiveTicket } from "@/components/live-ticket";
import { TicketSkeleton } from "@/components/loading";
import { SaveToPhone } from "@/components/save-to-phone";
import { StubCode, TicketCard } from "@/components/ticket";
import { useLive } from "@/components/use-live";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import { rememberTicket } from "@/lib/known-here";
import type { InviteLinkResponse } from "@/lib/types";
import { venue } from "@/venue";

export function InviteScreen({ code, first }: { code: string; first: InviteLinkResponse | null }) {
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
  const nightLabel = invite.nightTitle ? `${invite.nightTitle}, ${night(invite.night)}` : night(invite.night);

  if (data.viewerIsInviter) {
    return (
      <Notice title={fill(t.inviteLink.inviterView, { name: guestName })} body={`${nightLabel}. ${stateWord(t, invite.status, invite.admitted)}.`}>
        <Link href="/invites" className="btn btn-ink mt-5 w-full">
          {t.inviteLink.inviterManage}
        </Link>
      </Notice>
    );
  }

  if (invite.status === "declined") return <Notice title={t.inviteLink.declinedTitle} body={nightLabel} />;
  if (invite.status === "revoked") return <Notice title={t.inviteLink.revokedTitle} body={nightLabel} />;
  if (invite.status === "expired") return <Notice title={t.inviteLink.expiredTitle} body={nightLabel} />;

  if (invite.status === "accepted" && data.ticket) {
    return (
      <div className="flex w-full flex-col items-center gap-5">
        <LiveTicket ticket={data.ticket} serverTime={data.serverTime} tonight={data.tonight} />
        <SaveToPhone image={`/i/${encodeURIComponent(code)}/ticket.png`} fileName={`${venue.name.toLowerCase()}-${data.ticket.shortCode}`} />
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

  // Pending: the invite already is the ticket it will become — the guest's name, the night,
  // who vouches for them — with one thing missing: the code, and the button that prints it.
  // The same shape as a member's pass before it is claimed, so the two are learnt once.
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <h1 className="self-start text-4xl text-paper">{fill(t.inviteLink.title, { inviter: invite.inviterName })}</h1>

      <TicketCard
        nightLabel={nightLabel}
        firstName={invite.guestFirstName}
        lastName={invite.guestLastName}
        kindLabel={fill(t.ticket.guestOf, { name: invite.inviterName })}
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

function stateWord(t: ReturnType<typeof useI18n>["t"], status: string, admitted: boolean): string {
  if (admitted) return t.invites.stateAdmitted;
  const words: Record<string, string> = {
    pending: t.invites.statePending,
    accepted: t.invites.stateAccepted,
    declined: t.invites.stateDeclined,
    revoked: t.invites.stateRevoked,
    expired: t.invites.stateExpired,
  };
  return words[status] ?? status;
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
