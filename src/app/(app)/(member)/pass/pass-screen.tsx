"use client";

import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import { Field, FormError } from "@/components/field";
import { LiveTicket } from "@/components/live-ticket";
import { useMe, usePoll } from "@/components/me";
import { Stamp } from "@/components/stamp";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import type { Me, TonightResponse } from "@/lib/types";

export function PassScreen() {
  const { t, fill, night } = useI18n();
  const { me, setMe, refresh } = useMe();
  const [data, setData] = useState<TonightResponse | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.get<TonightResponse>("/pass/tonight"));
      setFailure(null);
    } catch (error) {
      // A failed poll must not wipe a pass that is already on screen.
      setFailure(isApiError(error) ? error.code : "server_error");
    }
  }, []);

  // Poll: this is how the phone learns the door let them in, or that the bar said yes.
  usePoll(() => {
    void load();
    if (me.status === "pending") void refresh();
  }, 4000);

  async function claim() {
    setClaiming(true);
    setFailure(null);
    try {
      setData(await api.post<TonightResponse>("/pass/claim"));
    } catch (error) {
      setFailure(isApiError(error) ? error.code : "server_error");
    }
    setClaiming(false);
  }

  if (!data) {
    return failure ? (
      <div className="paper p-5">
        <FormError code={failure} />
        <button type="button" className="btn btn-ink mt-4 w-full" onClick={() => void load()}>
          {t.common.retry}
        </button>
      </div>
    ) : (
      <div className="ticket h-[30rem] w-full animate-pulse opacity-40" aria-label={t.common.loading} />
    );
  }

  const { tonight, ticket } = data;

  return (
    <div className="flex flex-1 flex-col items-center gap-6">
      {ticket ? (
        <LiveTicket ticket={ticket} serverTime={data.serverTime} tonight={tonight.night} />
      ) : me.status === "banned" ? (
        <StatusCard title={t.pass.bannedTitle} body={t.pass.bannedBody} stamp={<Stamp word={t.status.banned} ink="red" size={104} />} />
      ) : me.status === "pending" ? (
        <StatusCard
          title={t.pass.pendingTitle}
          body={t.pass.pendingBody}
          stamp={<Stamp word={t.ticket.stampReview} ink="grey" size={104} />}
        />
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
        <div className="paper rise w-full p-6">
          <h1 className="text-4xl">{tonight.title ?? t.pass.claimTitle}</h1>
          <p className="mt-3 text-paper-soft">
            {fill(t.pass.claimBody, {
              open: tonight.doorsOpen,
              close: tonight.doorsClose,
              name: `${me.firstName} ${me.lastName}`,
            })}
          </p>
          {tonight.note && <p className="mt-2 font-semibold">{tonight.note}</p>}
          <button type="button" className="btn btn-ink btn-big mt-6 w-full" onClick={claim} disabled={claiming}>
            {claiming ? t.pass.claiming : t.pass.claim}
          </button>
        </div>
      ) : (
        <StatusCard title={t.pass.closedTitle} body={tonight.note ?? t.pass.closedBody} />
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

      {me.status === "approved" && (
        <p className="mt-auto pt-2 text-center text-sm text-ink-soft">
          {me.visits === 0 ? t.pass.visitsNone : me.visits === 1 ? t.pass.visitsOne : fill(t.pass.visitsMany, { n: me.visits })}
        </p>
      )}
    </div>
  );
}

function StatusCard({ title, body, stamp }: { title: string; body: string; stamp?: React.ReactNode }) {
  return (
    <div className="paper rise relative w-full overflow-hidden p-6">
      {stamp && <div className="absolute -right-3 -top-3">{stamp}</div>}
      <h1 className={`text-4xl ${stamp ? "max-w-[70%]" : ""}`}>{title}</h1>
      <p className="mt-3 text-paper-soft">{body}</p>
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
}: {
  title: string;
  body: string;
  note?: string | null;
  prompt: string | null;
  submit: string;
  current: string | null;
  onDone: (me: Me) => void;
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
    <form onSubmit={apply} noValidate className="paper rise w-full space-y-4 p-6">
      <div>
        <h1 className="text-4xl">{title}</h1>
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
    </form>
  );
}
