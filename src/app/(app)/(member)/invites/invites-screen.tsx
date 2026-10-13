"use client";

import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import { Field, FormError } from "@/components/field";
import { useMe, usePoll } from "@/components/me";
import { NightPicker } from "@/components/night-picker";
import { Qr } from "@/components/qr";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import type { Invite, InviteLinkResponse, InvitesOverview } from "@/lib/types";

export function InvitesScreen() {
  const { t, fill } = useI18n();
  const { me, refresh } = useMe();
  const [data, setData] = useState<InvitesOverview | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [created, setCreated] = useState<Invite | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.get<InvitesOverview>("/invites"));
      setFailure(null);
    } catch (error) {
      setFailure(isApiError(error) ? error.code : "server_error");
    }
  }, []);

  usePoll(load, 8000);

  async function act(action: () => Promise<unknown>) {
    setFailure(null);
    try {
      await action();
    } catch (error) {
      setFailure(isApiError(error) ? error.code : "server_error");
    }
    await Promise.all([load(), refresh()]);
  }

  if (!data) {
    return failure ? <FormError code={failure} /> : <p className="text-ink-soft">{t.common.loading}</p>;
  }

  return (
    <div className="space-y-10">
      <h1 className="text-5xl text-paper">{t.invites.title}</h1>

      {failure && <FormError code={failure} />}

      <section aria-labelledby="for-you">
        <h2 id="for-you" className="text-2xl text-paper">
          {t.invites.forYou}
        </h2>
        {data.received.length === 0 ? (
          <p className="mt-3 text-ink-soft">{t.invites.noneReceived}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.received.map((invite) => (
              <ReceivedInvite
                key={invite.id}
                invite={invite}
                onAccept={() => act(() => api.post<InviteLinkResponse>(`/invites/code/${invite.code}/accept`))}
                onDecline={() => act(() => api.post<InviteLinkResponse>(`/invites/code/${invite.code}/decline`))}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="from-you">
        <h2 id="from-you" className="text-2xl text-paper">
          {t.invites.fromYou}
        </h2>

        {!data.canInvite ? (
          <div className="mt-4 rounded-2xl border-2 border-ink-line p-5">
            <h3 className="text-lg text-paper-light">{t.invites.lockedTitle}</h3>
            <p className="mt-2 text-ink-soft">
              {me.status === "approved"
                ? fill(t.invites.lockedBody, { n: data.regularAfterVisits, v: data.visits })
                : t.invites.lockedNotMember}
            </p>
          </div>
        ) : created ? (
          <CreatedInvite invite={created} onAnother={() => setCreated(null)} />
        ) : (
          <NewInvite
            overview={data}
            onCreated={(invite) => {
              setCreated(invite);
              void load();
            }}
          />
        )}

        {data.sent.length > 0 && (
          <ul className="mt-6 space-y-3">
            {data.sent.map((invite) => (
              <SentInvite key={invite.id} invite={invite} onRevoke={() => act(() => api.post(`/invites/${invite.id}/revoke`))} />
            ))}
          </ul>
        )}
        {data.canInvite && data.sent.length === 0 && !created && <p className="mt-5 text-ink-soft">{t.invites.noneSent}</p>}
      </section>
    </div>
  );
}

function stateLabel(t: ReturnType<typeof useI18n>["t"], invite: Invite): string {
  if (invite.admitted) return t.invites.stateAdmitted;
  return {
    pending: t.invites.statePending,
    accepted: t.invites.stateAccepted,
    declined: t.invites.stateDeclined,
    revoked: t.invites.stateRevoked,
    expired: t.invites.stateExpired,
  }[invite.status];
}

function nightLine(invite: Invite, night: (n: string, s?: "short" | "long") => string): string {
  return invite.nightTitle ? `${night(invite.night, "long")}, ${invite.nightTitle}` : night(invite.night, "long");
}

function ReceivedInvite({ invite, onAccept, onDecline }: { invite: Invite; onAccept: () => void; onDecline: () => void }) {
  const { t, fill, night } = useI18n();
  const [busy, setBusy] = useState(false);
  const run = (action: () => void) => {
    setBusy(true);
    action();
  };

  return (
    <li className="paper p-5">
      <p className="text-sm font-bold text-paper-soft">{nightLine(invite, night)}</p>
      <h3 className="mt-1 text-xl">{fill(t.invites.invitedYou, { name: invite.inviterName })}</h3>
      <p className="mt-1 text-paper-soft">
        {invite.guestFirstName} {invite.guestLastName}
      </p>

      {invite.status === "pending" ? (
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn btn-ink flex-1" disabled={busy} onClick={() => run(onAccept)}>
            {t.invites.accept}
          </button>
          <button type="button" className="btn btn-line flex-1" disabled={busy} onClick={() => run(onDecline)}>
            {t.invites.decline}
          </button>
        </div>
      ) : invite.status === "accepted" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href={`/i/${invite.code}`} className="btn btn-ink flex-1">
            {t.invites.openTicket}
          </Link>
          {!invite.admitted && (
            <button type="button" className="btn btn-line btn-small" disabled={busy} onClick={() => run(onDecline)}>
              {t.invites.cantCome}
            </button>
          )}
        </div>
      ) : (
        <p className="chip mt-3">{stateLabel(t, invite)}</p>
      )}
    </li>
  );
}

function SentInvite({ invite, onRevoke }: { invite: Invite; onRevoke: () => void }) {
  const { t, night } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const open = (invite.status === "pending" || invite.status === "accepted") && !invite.admitted;

  return (
    <li className="rounded-2xl border-2 border-ink-line p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-paper-light">
            {invite.guestFirstName} {invite.guestLastName}
          </p>
          <p className="text-sm text-ink-soft">{nightLine(invite, night)}</p>
          {invite.guestPersonalNumber && <p className="tabular text-sm text-ink-soft">{invite.guestPersonalNumber}</p>}
        </div>
        <span className={`chip flex-none ${invite.admitted ? "text-go" : open ? "text-paper" : "text-ink-soft"}`}>
          {stateLabel(t, invite)}
        </span>
      </div>

      {open &&
        (confirming ? (
          <div className="mt-4">
            <p className="text-paper-light">{t.invites.revokeConfirm}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn btn-stop btn-small flex-1" onClick={onRevoke}>
                {t.invites.revoke}
              </button>
              <button type="button" className="btn btn-line btn-small flex-1 text-paper-light" onClick={() => setConfirming(false)}>
                {t.invites.keep}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2 text-paper-light">
            <ShareLink code={invite.code} small />
            <button type="button" className="btn btn-line btn-small" onClick={() => setConfirming(true)}>
              {t.invites.revoke}
            </button>
          </div>
        ))}
    </li>
  );
}

function inviteUrl(code: string): string {
  return `${window.location.origin}/i/${code}`;
}

/** Shares the invite link through the phone's own share sheet, or copies it where there is none. */
function ShareLink({ code, small = false }: { code: string; small?: boolean }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = inviteUrl(code);
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // Dismissed the sheet, or sharing is not allowed here: fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(t.common.copyLink, url);
    }
  }

  return (
    <button type="button" className={`btn ${small ? "btn-line btn-small" : "btn-ink w-full"}`} onClick={share} aria-live="polite">
      {copied ? t.common.copied : t.common.share}
    </button>
  );
}

function CreatedInvite({ invite, onAnother }: { invite: Invite; onAnother: () => void }) {
  const { t, fill } = useI18n();
  return (
    <div className="paper rise mt-4 space-y-4 p-5">
      <div>
        <h3 className="display text-3xl">{t.invites.createdTitle}</h3>
        <p className="mt-2 text-paper-soft">
          {fill(t.invites.createdBody, { name: `${invite.guestFirstName} ${invite.guestLastName}` })}
        </p>
      </div>
      {/* Phone to phone: the guest can scan this straight off the member's screen. */}
      <div className="mx-auto w-44 rounded-2xl bg-qr p-4 text-ink-deep">
        <Qr value={inviteUrl(invite.code)} label={t.common.share} className="block w-full" />
      </div>
      <ShareLink code={invite.code} />
      <button type="button" className="btn btn-line w-full" onClick={onAnother}>
        {t.invites.another}
      </button>
    </div>
  );
}

function NewInvite({ overview, onCreated }: { overview: InvitesOverview; onCreated: (invite: Invite) => void }) {
  const { t } = useI18n();
  // Start on the first night that can actually be invited to.
  const firstFree = overview.nights.find((n) => n.open && n.remaining > 0)?.night ?? "";
  const [selected, setSelected] = useState(firstFree);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);

  if (!overview.nights.some((n) => n.open)) return <p className="mt-4 text-ink-soft">{t.invites.noNights}</p>;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFields({});
    setFailure(null);
    try {
      onCreated(
        await api.post<Invite>("/invites", {
          night: selected,
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          personalNumber: form.get("personalNumber"),
          phone: form.get("phone"),
        }),
      );
    } catch (error) {
      if (isApiError(error)) {
        setFields(error.fields);
        setFailure(error.fields.night ?? (Object.keys(error.fields).length > 0 ? "validation" : error.code));
      } else {
        setFailure("server_error");
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="paper mt-4 space-y-4 p-5">
      <div>
        <h3 className="display text-3xl">{t.invites.newTitle}</h3>
        <p className="mt-2 text-paper-soft">{t.invites.newIntro}</p>
      </div>

      <FormError code={failure} />

      <div>
        <p className="label">{t.invites.night}</p>
        <NightPicker nights={overview.nights} value={selected} onChange={setSelected} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.invites.guestFirst} name="firstName" autoComplete="off" required error={fields.firstName} />
        <Field label={t.invites.guestLast} name="lastName" autoComplete="off" required error={fields.lastName} />
      </div>
      <Field
        label={t.common.personalNumber}
        name="personalNumber"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        optional
        hint={t.invites.personalHint}
        error={fields.personalNumber}
      />
      <Field
        label={t.invites.guestPhone}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        optional
        hint={t.invites.guestPhoneHint}
        error={fields.phone}
      />

      <button type="submit" className="btn btn-ink btn-big w-full" disabled={busy || !selected}>
        {busy ? t.invites.creating : t.invites.create}
      </button>
    </form>
  );
}
