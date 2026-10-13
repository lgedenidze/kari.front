"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { LangToggle } from "@/components/app-chrome";
import { Field, FormError, useFirstMistake } from "@/components/field";
import { useMe } from "@/components/me";
import { PhotoPicker } from "@/components/photo-picker";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import { forgetAll } from "@/lib/live-store";
import type { Me } from "@/lib/types";

/**
 * The profile fits one screen: who you are, then a short list of things that can be changed.
 * A name and a password are changed once in a blue moon, so their forms stay folded away
 * behind their own row until they are asked for.
 */
export function ProfileScreen() {
  const { t } = useI18n();
  const { me, setMe } = useMe();
  const router = useRouter();

  async function signOut() {
    await api.post("/auth/logout").catch(() => {});
    // Nothing this account saw may be shown to whoever signs in next on this phone.
    forgetAll();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <h1 className="title pb-2 text-paper">{t.profile.title}</h1>

      <section className="paper space-y-4 p-5">
        <div>
          <p className="display break-words text-3xl">
            {me.firstName} {me.lastName}
          </p>
          <p className="tabular mt-1 text-paper-soft">{me.phone}</p>
        </div>

        <Photo me={me} onSaved={setMe} />

        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-sm font-semibold text-paper-soft">{t.profile.membership}</dt>
            <dd className="font-bold">{t.status[me.status]}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-paper-soft">{t.profile.nights}</dt>
            <dd className="tabular font-bold">{me.visits}</dd>
          </div>
        </dl>
        {me.facebookUrl && (
          <p className="truncate text-sm">
            <a href={me.facebookUrl} target="_blank" rel="noopener" className="link">
              {me.facebookUrl.replace("https://www.", "")}
            </a>
          </p>
        )}
      </section>

      <NameForm me={me} onSaved={setMe} />
      <PasswordForm />

      <section className="flex min-h-[3.75rem] items-center justify-between gap-3 rounded-2xl border-2 border-ink-line px-4 py-2.5">
        <p className="font-bold text-paper-light">{t.common.language}</p>
        <LangToggle className="text-paper-light" />
      </section>

      <button type="button" className="btn btn-line w-full text-paper-light" onClick={signOut}>
        {t.common.signOut}
      </button>

      <DeleteAccount />
    </div>
  );
}

/**
 * A form opened from a row is brought whole into view, clear of the dock: its buttons are at
 * its foot, and the foot of the screen is where the dock floats.
 */
function useBroughtIntoView(form: RefObject<HTMLFormElement | null>, open: boolean) {
  useEffect(() => {
    if (open) form.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [form, open]);
}

/** One line of the list: what it changes, and an arrow that says it opens. */
function Row({ label, done = false, onOpen }: { label: string; done?: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-live="polite"
      className="flex min-h-[3.75rem] w-full items-center justify-between gap-3 rounded-2xl border-2 border-ink-line px-4 py-2.5 text-left font-bold text-paper-light transition-colors hover:bg-ink-raised active:bg-ink-raised"
    >
      <span className={done ? "text-go" : ""}>{label}</span>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-ink-soft">
        <path d="m9 5.5 6.5 6.5L9 18.5" />
      </svg>
    </button>
  );
}

function Photo({ me, onSaved }: { me: Me; onSaved: (me: Me) => void }) {
  const { t } = useI18n();
  // The stored photo is behind sign-in; the version suffix busts the cache after a change.
  const [version, setVersion] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);

  async function change(photo: string | null) {
    setFailure(null);
    try {
      onSaved(photo ? await api.put<Me>("/me/photo", { photo }) : await api.delete<Me>("/me/photo"));
      setVersion((v) => v + 1);
    } catch (error) {
      setFailure(isApiError(error) ? (error.fields.photo ?? error.code) : "server_error");
    }
  }

  return (
    <div role="group" aria-label={t.profile.photoSection}>
      <PhotoPicker bare value={me.hasPhoto ? `/api/photos/${me.id}?v=${version}` : null} onChange={change} error={failure ?? undefined} />
    </div>
  );
}

function NameForm({ me, onSaved }: { me: Me; onSaved: (me: Me) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  useFirstMistake(form, fields);
  useBroughtIntoView(form, open);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sent = new FormData(event.currentTarget);
    setBusy(true);
    setFields({});
    setFailure(null);
    try {
      onSaved(await api.patch<Me>("/me", { firstName: sent.get("firstName"), lastName: sent.get("lastName") }));
      // The new name is at the top of the screen: that is the receipt.
      setOpen(false);
    } catch (error) {
      if (isApiError(error) && Object.keys(error.fields).length > 0) setFields(error.fields);
      else setFailure(isApiError(error) ? error.code : "server_error");
    }
    setBusy(false);
  }

  if (!open) return <Row label={t.profile.changeName} onOpen={() => setOpen(true)} />;

  return (
    <form ref={form} onSubmit={submit} noValidate className="paper rise scroll-mb-32 scroll-mt-4 space-y-4 p-5">
      <h2 className="text-2xl">{t.profile.changeName}</h2>
      <FormError code={failure} />
      <div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.common.firstName} name="firstName" defaultValue={me.firstName} autoComplete="given-name" error={fields.firstName} />
          <Field label={t.common.lastName} name="lastName" defaultValue={me.lastName} autoComplete="family-name" error={fields.lastName} />
        </div>
        <p className="hint">{t.join.nameNote}</p>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-ink flex-1" disabled={busy}>
          {t.common.save}
        </button>
        <button type="button" className="btn btn-line flex-1" onClick={() => setOpen(false)}>
          {t.common.cancel}
        </button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  useFirstMistake(form, fields);
  useBroughtIntoView(form, open);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sent = new FormData(event.currentTarget);
    setBusy(true);
    setFields({});
    setFailure(null);
    try {
      await api.post("/me/password", { current: sent.get("current"), next: sent.get("next") });
      // Folded away again, with the row itself saying it worked.
      setDone(true);
      setOpen(false);
    } catch (error) {
      if (isApiError(error) && Object.keys(error.fields).length > 0) setFields(error.fields);
      else setFailure(isApiError(error) ? error.code : "server_error");
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <Row
        label={done ? t.profile.passwordChanged : t.profile.changePassword}
        done={done}
        onOpen={() => {
          setDone(false);
          setOpen(true);
        }}
      />
    );
  }

  return (
    <form ref={form} onSubmit={submit} noValidate className="paper rise scroll-mb-32 scroll-mt-4 space-y-4 p-5">
      <h2 className="text-2xl">{t.profile.changePassword}</h2>
      <FormError code={failure} />
      <Field label={t.profile.currentPassword} name="current" type="password" autoComplete="current-password" error={fields.current} />
      <Field
        label={t.profile.newPassword}
        name="next"
        type="password"
        autoComplete="new-password"
        hint={t.join.passwordHint}
        error={fields.next}
      />
      <div className="flex gap-2">
        <button type="submit" className="btn btn-ink flex-1" disabled={busy}>
          {t.common.save}
        </button>
        <button type="button" className="btn btn-line flex-1" onClick={() => setOpen(false)}>
          {t.common.cancel}
        </button>
      </div>
    </form>
  );
}

function DeleteAccount() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  useBroughtIntoView(form, open);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFieldError(undefined);
    setFailure(null);
    try {
      await api.post("/me/delete", { password: new FormData(event.currentTarget).get("password") });
      router.push("/");
      router.refresh();
    } catch (error) {
      if (isApiError(error) && error.fields.password) setFieldError(error.fields.password);
      else setFailure(isApiError(error) ? error.code : "server_error");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="link mx-auto block px-3 py-2.5 text-sm text-ink-soft" onClick={() => setOpen(true)}>
        {t.profile.deleteAccount}
      </button>
    );
  }

  return (
    <form ref={form} onSubmit={submit} noValidate className="paper rise scroll-mb-32 scroll-mt-4 space-y-4 p-5">
      <h2 className="text-2xl">{t.profile.deleteAccount}</h2>
      <p className="text-paper-soft">{t.profile.deleteBody}</p>
      <FormError code={failure} />
      <Field label={t.profile.deleteConfirm} name="password" type="password" autoComplete="current-password" error={fieldError} />
      <div className="flex gap-2">
        <button type="submit" className="btn btn-danger flex-1" disabled={busy}>
          {t.profile.deleteSubmit}
        </button>
        <button type="button" className="btn btn-line flex-1" onClick={() => setOpen(false)}>
          {t.common.cancel}
        </button>
      </div>
    </form>
  );
}
