"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Field, FormError, useFirstMistake } from "@/components/field";
import { RowsSkeleton } from "@/components/loading";
import { useMe } from "@/components/me";
import { NightPicker } from "@/components/night-picker";
import { Qr } from "@/components/qr";
import { refreshLive, useLive } from "@/components/use-live";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import type { Invite, InviteLinkResponse, InvitesOverview } from "@/lib/types";
import { venue } from "@/venue";

/** Invites on their way: the title is already true, so it is already there. */
export function InvitesSkeleton() {
  const { t } = useI18n();
  return (
    <div className="space-y-8">
      <h1 className="title text-paper">{t.invites.title}</h1>
      <RowsSkeleton rows={3} />
    </div>
  );
}

/**
 * Inviting a guest is three things, in the order a member thinks of them: who, which night,
 * send. So the screen is the form, and the form is a name, a row of nights and one button —
 * all of it in view at once. What comes back is a sheet with the link to send: the job is not
 * done until the guest has it, so that is the only thing on screen until the member says so.
 */
export function InvitesScreen({ first }: { first: InvitesOverview | null }) {
  const { t, error } = useI18n();
  const { me, refresh } = useMe();
  const router = useRouter();
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
                // A yes goes straight to where the ticket is: the pass, not a second button here.
                onAccept={() =>
                  act(() => api.post<InviteLinkResponse>(`/invites/code/${invite.code}/accept`).then(() => router.push("/pass")))
                }
                onDecline={() => act(() => api.post<InviteLinkResponse>(`/invites/code/${invite.code}/decline`))}
              />
            ))}
          </ul>
        </section>
      )}

      {!data.canInvite ? (
        // Inviting is a permission, and this account does not have it: not a member yet, or a
        // member the bar switched it off for. One line. There is nothing here to work towards.
        <p className="rounded-2xl border-2 border-ink-line p-5 text-ink-soft">
          {me.status === "approved" ? error("cannot_invite") : t.invites.lockedNotMember}
        </p>
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
        <section aria-labelledby="sent">
          <h2 id="sent" className="text-2xl text-paper">
            {t.invites.fromYou}
          </h2>
          <ul className="mt-4 space-y-3">
            {data.sent.map((invite) => (
              <SentInvite key={invite.id} invite={invite} onRevoke={() => act(() => api.post(`/invites/${invite.id}/revoke`))} />
            ))}
          </ul>
        </section>
      )}

      {created && <CreatedSheet invite={created} onClose={() => setCreated(null)} />}
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

function ReceivedInvite({
  invite,
  onAccept,
  onDecline,
}: {
  invite: Invite;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
}) {
  const { t, fill, night } = useI18n();
  const [busy, setBusy] = useState(false);
  // Saying no cannot be taken back, and its button sits beside "accept": it is asked for twice.
  const [declining, setDeclining] = useState(false);
  const run = (action: () => Promise<void>) => {
    setBusy(true);
    void action().finally(() => {
      setBusy(false);
      setDeclining(false);
    });
  };

  return (
    <li className="paper p-5">
      <p className="text-sm font-bold text-paper-soft">{nightLine(invite, night)}</p>
      <h3 className="mt-1 text-xl">{fill(t.invites.invitedYou, { name: invite.inviterName })}</h3>
      <p className="mt-1 text-paper-soft">
        {invite.guestFirstName} {invite.guestLastName}
      </p>

      {declining ? (
        <div className="rise mt-4">
          <p className="font-semibold">{t.invites.declineConfirm}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn btn-danger flex-1" disabled={busy} onClick={() => run(onDecline)}>
              {t.invites.decline}
            </button>
            <button type="button" className="btn btn-line flex-1" disabled={busy} onClick={() => setDeclining(false)}>
              {t.common.back}
            </button>
          </div>
        </div>
      ) : invite.status === "pending" ? (
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn btn-ink flex-[2]" disabled={busy} onClick={() => run(onAccept)}>
            {t.invites.accept}
          </button>
          <button type="button" className="btn btn-line flex-1" disabled={busy} onClick={() => setDeclining(true)}>
            {t.invites.decline}
          </button>
        </div>
      ) : invite.status === "accepted" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href={`/i/${invite.code}`} className="btn btn-ink flex-1">
            {t.invites.openTicket}
          </Link>
          {!invite.admitted && (
            <button type="button" className="btn btn-line btn-small" disabled={busy} onClick={() => setDeclining(true)}>
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
            <ShareLink invite={invite} small />
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

/**
 * Sends the invite link through the phone's own share sheet, with a line saying what it is,
 * or copies it where there is no sheet.
 */
function ShareLink({ invite, small = false }: { invite: Invite; small?: boolean }) {
  const { t, fill, night } = useI18n();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = inviteUrl(invite.code);
    if (navigator.share) {
      try {
        // The words travel with the link, so the guest's chat shows what it is for.
        await navigator.share({ text: fill(t.invites.shareText, { venue: venue.name, night: nightLine(invite, night, "short") }), url });
        return;
      } catch (error) {
        // Closed the sheet: that is an answer. Anything else, fall through to copying.
        if (error instanceof DOMException && error.name === "AbortError") return;
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
    <button type="button" className={`btn ${small ? "btn-paper btn-small" : "btn-ink btn-big w-full"}`} onClick={share} aria-live="polite">
      {copied ? t.common.copied : t.common.share}
    </button>
  );
}

/**
 * The invite is made; now it has to reach the guest. A sheet over the whole screen, with the
 * two ways to hand it over — send the link, or let the guest scan it off this phone — and
 * nothing else until the member closes it.
 */
function CreatedSheet({ invite, onClose }: { invite: Invite; onClose: () => void }) {
  const { t, night } = useI18n();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink-deep/85 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={t.invites.createdTitle}
      onClick={onClose}
    >
      <div
        className="paper rise w-full max-w-sm space-y-4 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div>
          <h2 className="text-3xl">{t.invites.createdTitle}</h2>
          <p className="display mt-3 break-words text-2xl">
            {invite.guestFirstName} {invite.guestLastName}
          </p>
          <p className="mt-1 text-sm font-semibold text-paper-soft">{nightLine(invite, night)}</p>
        </div>
        {/* Phone to phone: the guest can scan this straight off the member's screen. */}
        <div className="mx-auto w-40 rounded-2xl bg-qr p-4 text-ink-deep">
          <Qr value={inviteUrl(invite.code)} label={t.common.share} className="block w-full" />
        </div>
        <p className="text-sm text-paper-soft">{t.invites.createdBody}</p>
        <ShareLink invite={invite} />
        <button type="button" className="btn btn-line w-full" onClick={onClose}>
          {t.common.close}
        </button>
      </div>
    </div>
  );
}

function NewInvite({ overview, onCreated }: { overview: InvitesOverview; onCreated: (invite: Invite) => void }) {
  const { t } = useI18n();
  // Start on the first night that can actually be invited to. With every night used up, on
  // the first open one: the line under the row then says there is nothing left to send.
  const firstFree = (overview.nights.find((n) => n.open && n.remaining > 0) ?? overview.nights.find((n) => n.open))?.night ?? "";
  const [selected, setSelected] = useState(firstFree);
  const usedUp = overview.nights.find((n) => n.night === selected)?.remaining === 0;
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  // The two things that may be added about a guest are folded away until they are wanted —
  // and unfolded by themselves when the API finds a mistake in one.
  const [more, setMore] = useState(false);
  const extras = more || Boolean(fields.personalNumber || fields.phone);
  const form = useRef<HTMLFormElement>(null);
  useFirstMistake(form, fields);

  if (!overview.nights.some((n) => n.open)) {
    return <p className="rounded-2xl border-2 border-ink-line p-5 text-ink-soft">{t.invites.noNights}</p>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const sent = new FormData(target);
    setBusy(true);
    setFields({});
    setFailure(null);
    try {
      const invite = await api.post<Invite>("/invites", {
        night: selected,
        firstName: sent.get("firstName"),
        lastName: sent.get("lastName"),
        personalNumber: sent.get("personalNumber"),
        phone: sent.get("phone"),
      });
      // Ready for the next guest behind the sheet: empty, and folded as it started.
      target.reset();
      setMore(false);
      onCreated(invite);
    } catch (error) {
      if (isApiError(error)) {
        setFields(error.fields);
        setFailure(error.fields.night ?? (Object.keys(error.fields).length > 0 ? "validation" : error.code));
      } else {
        setFailure("server_error");
      }
    }
    setBusy(false);
  }

  return (
    <form ref={form} onSubmit={submit} noValidate className="paper space-y-4 p-5" aria-labelledby="new-invite">
      <h2 id="new-invite" className="display text-3xl">
        {t.invites.newTitle}
      </h2>

      <FormError code={failure} />

      {/* Who first: it is what the member came to type. */}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.common.firstName} name="firstName" autoComplete="off" required error={fields.firstName} />
        <Field label={t.common.lastName} name="lastName" autoComplete="off" required error={fields.lastName} />
      </div>

      <div>
        <p className="label">{t.invites.night}</p>
        <NightPicker nights={overview.nights} value={selected} onChange={setSelected} />
      </div>

      {extras ? (
        <div className="rise space-y-4">
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
        </div>
      ) : (
        <button type="button" className="link flex min-h-11 items-center text-left text-sm" onClick={() => setMore(true)}>
          {t.invites.more}
        </button>
      )}

      <button type="submit" className="btn btn-ink btn-big w-full" disabled={busy || !selected || usedUp}>
        {busy ? t.invites.creating : t.invites.create}
      </button>
    </form>
  );
}
