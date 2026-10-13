"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Field, FormError, useFirstMistake } from "@/components/field";
import { RowsSkeleton } from "@/components/loading";
import { useMe } from "@/components/me";
import { NightPicker } from "@/components/night-picker";
import { Qr } from "@/components/qr";
import { refreshLive, useLive } from "@/components/use-live";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import type { Invite, InviteLinkResponse, InvitesOverview } from "@/lib/types";

/** Invites on their way: the title is already true, so it is already there. */
export function InvitesSkeleton() {
  const { t } = useI18n();
  return (
    <div className="space-y-10">
      <h1 className="title text-paper">{t.invites.title}</h1>
      <RowsSkeleton rows={3} />
    </div>
  );
}

export function InvitesScreen({ first }: { first: InvitesOverview | null }) {
  const { t, fill } = useI18n();
  const { me, refresh } = useMe();
  const live = useLive<InvitesOverview>("/invites", { every: 8000, first });
  const { data } = live;
  const load = live.reload;
  const [actionFailure, setActionFailure] = useState<string | null>(null);
  const [created, setCreated] = useState<Invite | null>(null);
  const failure = actionFailure ?? live.failure;

  async function act(action: () => Promise<unknown>) {
    setActionFailure(null);
    try {
      await action();
    } catch (error) {
      setActionFailure(isApiError(error) ? error.code : "server_error");
    }
    // An answered invite changes the pass screen too: have it ready before they get there.
    refreshLive("/pass/tonight");
    await Promise.all([load(), refresh()]);
  }

  if (!data) {
    return failure ? <FormError code={failure} /> : <InvitesSkeleton />;
  }

  return (
    <div className="space-y-8">
      <h1 className="title text-paper">{t.invites.title}</h1>

      {failure && <FormError code={failure} />}

      {/* Invites that want an answer come first — and only when there are some. With none,
          the screen is simply the form: an empty list gets no heading and no sentence. */}
      {data.received.length > 0 && (
        <section aria-labelledby="for-you">
          <h2 id="for-you" className="text-2xl text-paper">
            {t.invites.forYou}
          </h2>
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
        </section>
      )}

      <section aria-label={t.invites.fromYou} className="space-y-4">
        {/* The two halves are only named when both are on screen. */}
        {data.received.length > 0 && <h2 className="text-2xl text-paper">{t.invites.fromYou}</h2>}

        {!data.canInvite ? (
          <div className="rounded-2xl border-2 border-ink-line p-5">
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
          <ul className="space-y-3 pt-2">
            {data.sent.map((invite) => (
              <SentInvite key={invite.id} invite={invite} onRevoke={() => act(() => api.post(`/invites/${invite.id}/revoke`))} />
            ))}
          </ul>
        )}
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

function nightLine(invite: Invite, night: (n: string, s?: "short" | "long") => string, style: "short" | "long" = "long"): string {
  return invite.nightTitle ? `${night(invite.night, style)}, ${invite.nightTitle}` : night(invite.night, style);
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
      {/* Who, and where it stands, share the first line; the night has the next one to itself,
          so a long Georgian date is never squeezed beside the chip. */}
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-lg font-bold text-paper-light">
          {invite.guestFirstName} {invite.guestLastName}
        </p>
        <span className={`chip flex-none ${invite.admitted ? "text-go" : open ? "text-paper" : "text-ink-soft"}`}>
          {stateLabel(t, invite)}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-ink-soft">
        {nightLine(invite, night, "short")}
        {invite.guestPersonalNumber && <span className="tabular">, {invite.guestPersonalNumber}</span>}
      </p>

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
          <div className="mt-3 grid grid-cols-2 gap-2 text-paper-light">
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
    <button type="button" className={`btn ${small ? "btn-paper btn-small" : "btn-ink w-full"}`} onClick={share} aria-live="polite">
      {copied ? t.common.copied : t.common.share}
    </button>
  );
}

function CreatedInvite({ invite, onAnother }: { invite: Invite; onAnother: () => void }) {
  const { t, fill } = useI18n();
  return (
    <div className="paper rise space-y-4 p-5">
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
  const form = useRef<HTMLFormElement>(null);
  useFirstMistake(form, fields);

  if (!overview.nights.some((n) => n.open)) return <p className="text-ink-soft">{t.invites.noNights}</p>;

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
    <form ref={form} onSubmit={submit} noValidate className="paper space-y-4 p-5">
      <h3 className="display text-3xl">{t.invites.newTitle}</h3>

      <FormError code={failure} />

      <div>
        <p className="label">{t.invites.night}</p>
        <NightPicker nights={overview.nights} value={selected} onChange={setSelected} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t.common.firstName} name="firstName" autoComplete="off" required error={fields.firstName} />
        <Field label={t.common.lastName} name="lastName" autoComplete="off" required error={fields.lastName} />
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
