"use client";

import Link from "next/link";
import { useState } from "react";
import { FormError } from "@/components/field";
import { LiveTicket } from "@/components/live-ticket";
import { TicketSkeleton } from "@/components/loading";
import { SaveToPhone } from "@/components/save-to-phone";
import { StubCode, TicketCard } from "@/components/ticket";
import { useLive } from "@/components/use-live";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import type { InviteLinkResponse } from "@/lib/types";

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
        <SaveToPhone />
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

  // Pending: the invite already looks like the ticket it will become.
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <h1 className="self-start text-4xl text-paper">{fill(t.inviteLink.title, { inviter: invite.inviterName })}</h1>

      <TicketCard
        nightLabel={nightLabel}
        firstName={invite.guestFirstName}
        lastName={invite.guestLastName}
        kindLabel={fill(t.ticket.guestOf, { name: invite.inviterName })}
        stubLeft={
          invite.guestPersonalNumber ? <StubCode label={t.common.personalNumber} code={invite.guestPersonalNumber} /> : <span />
        }
        poweredBy={t.common.poweredBy}
      >
        <div className="flex aspect-[4/3] w-full flex-col justify-center gap-2 text-center">
          <p className="text-lg font-bold leading-snug">{fill(t.inviteLink.forName, { name: guestName })}</p>
          <p className="text-sm text-paper-soft">{t.inviteLink.idNote}</p>
        </div>
      </TicketCard>

      {failure && (
        <div className="w-full">
          <FormError code={failure} />
        </div>
      )}

      <div className="w-full max-w-[22rem] space-y-3">
        <button type="button" className="btn btn-paper btn-big w-full" disabled={busy} onClick={() => answer("accept")}>
          {busy ? t.inviteLink.accepting : t.inviteLink.accept}
        </button>
        <button type="button" className="btn btn-line w-full text-paper-light" disabled={busy} onClick={() => answer("decline")}>
          {t.invites.decline}
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
