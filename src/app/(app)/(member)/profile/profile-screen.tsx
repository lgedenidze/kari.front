"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LangToggle } from "@/components/app-chrome";
import { Field, FormError } from "@/components/field";
import { useMe } from "@/components/me";
import { PhotoPicker } from "@/components/photo-picker";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import type { Me } from "@/lib/types";

export function ProfileScreen() {
  const { t } = useI18n();
  const { me, setMe } = useMe();
  const router = useRouter();

  async function signOut() {
    await api.post("/auth/logout").catch(() => {});
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-5xl text-paper">{t.profile.title}</h1>

      <section className="paper space-y-1 p-5">
        <p className="display text-3xl">
          {me.firstName} {me.lastName}
        </p>
        <p className="tabular text-paper-soft">{me.phone}</p>
        <dl className="grid grid-cols-2 gap-3 pt-3">
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
          <p className="truncate pt-2 text-sm">
            <span className="font-semibold text-paper-soft">{t.profile.facebook}: </span>
            <a href={me.facebookUrl} target="_blank" rel="noopener" className="link">
              {me.facebookUrl.replace("https://www.", "")}
            </a>
          </p>
        )}
      </section>

      <NameForm me={me} onSaved={setMe} />
      <PhotoForm me={me} onSaved={setMe} />
      <PasswordForm />

      <section className="flex items-center justify-between gap-3 rounded-2xl border-2 border-ink-line p-4">
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

function NameForm({ me, onSaved }: { me: Me; onSaved: (me: Me) => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setSaved(false);
    setFields({});
    setFailure(null);
    try {
      onSaved(await api.patch<Me>("/me", { firstName: form.get("firstName"), lastName: form.get("lastName") }));
      setSaved(true);
    } catch (error) {
      if (isApiError(error) && Object.keys(error.fields).length > 0) setFields(error.fields);
      else setFailure(isApiError(error) ? error.code : "server_error");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} noValidate className="paper space-y-4 p-5">
      <h2 className="text-2xl">{t.profile.nameSection}</h2>
      <FormError code={failure} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.common.firstName} name="firstName" defaultValue={me.firstName} autoComplete="given-name" error={fields.firstName} />
        <Field label={t.common.lastName} name="lastName" defaultValue={me.lastName} autoComplete="family-name" error={fields.lastName} />
      </div>
      <p className="hint">{t.join.nameNote}</p>
      <button type="submit" className="btn btn-ink w-full" disabled={busy} aria-live="polite">
        {saved ? t.common.saved : t.common.save}
      </button>
    </form>
  );
}

function PhotoForm({ me, onSaved }: { me: Me; onSaved: (me: Me) => void }) {
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
    <section className="paper space-y-3 p-5">
      <h2 className="sr-only">{t.profile.photoSection}</h2>
      <PhotoPicker value={me.hasPhoto ? `/api/photos/${me.id}?v=${version}` : null} onChange={change} error={failure ?? undefined} />
    </section>
  );
}

function PasswordForm() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    setBusy(true);
    setDone(false);
    setFields({});
    setFailure(null);
    try {
      await api.post("/me/password", { current: form.get("current"), next: form.get("next") });
      target.reset();
      setDone(true);
    } catch (error) {
      if (isApiError(error) && Object.keys(error.fields).length > 0) setFields(error.fields);
      else setFailure(isApiError(error) ? error.code : "server_error");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} noValidate className="paper space-y-4 p-5">
      <h2 className="text-2xl">{t.profile.passwordSection}</h2>
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
      <button type="submit" className="btn btn-ink w-full" disabled={busy} aria-live="polite">
        {done ? t.profile.passwordChanged : t.profile.changePassword}
      </button>
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
      <button type="button" className="link mx-auto block py-2 text-sm text-ink-soft" onClick={() => setOpen(true)}>
        {t.profile.deleteAccount}
      </button>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="paper space-y-4 p-5">
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
