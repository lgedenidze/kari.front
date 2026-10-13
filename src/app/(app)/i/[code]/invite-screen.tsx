"use client";

import Link from "next/link";
import { useState } from "react";
import { FormError } from "@/components/field";
import { PassIcon } from "@/components/icons";
import { LiveTicket } from "@/components/live-ticket";
import { TicketSkeleton } from "@/components/loading";
import { SaveToPhone } from "@/components/save-to-phone";
import { StubCode, TicketCard } from "@/components/ticket";
import { useLive } from "@/components/use-live";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
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
        {!invite.admitted && (
          <button type="button" className="link text-sm text-ink-soft" disabled={busy} onClick={() => answer("decline")}>
            {t.invites.cantCome}
          </button>
        )}
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
        caption={<p className="font-normal text-paper-soft">{t.inviteLink.idNote}</p>}
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

      <button type="button" className="link px-3 py-2.5 text-ink-soft" disabled={busy} onClick={() => answer("decline")}>
        {t.invites.cantCome}
      </button>
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
