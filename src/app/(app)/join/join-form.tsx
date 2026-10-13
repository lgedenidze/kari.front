"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Field, FormError, useFirstMistake } from "@/components/field";
import { PhotoPicker } from "@/components/photo-picker";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import { openFresh } from "@/lib/fresh-page";
import type { Me } from "@/lib/types";
import { venue } from "@/venue";

export function JoinForm() {
  const { t, fill, lang, error: errorText } = useI18n();
  const [photo, setPhoto] = useState<string | null>(null);
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  useFirstMistake(form, fields);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFields({});
    setFailure(null);
    try {
      await api.post<Me>("/auth/register", {
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        phone: form.get("phone"),
        password: form.get("password"),
        facebookUrl: form.get("facebookUrl"),
        photo,
        lang,
        adult,
        consent,
      });
      // A whole new page: nothing held for an earlier account on this phone survives it.
      openFresh("/pass");
    } catch (error) {
      if (isApiError(error)) {
        setFields(error.fields);
        // A field error explains itself next to the field; anything else goes on top.
        setFailure(Object.keys(error.fields).length > 0 ? "validation" : error.code);
      } else {
        setFailure("server_error");
      }
      setBusy(false);
    }
  }

  return (
    <form ref={form} onSubmit={submit} noValidate className="paper rise space-y-5 p-5 sm:p-7">
      <h1 className="text-4xl">{t.join.title}</h1>

      <FormError code={failure} />

      {/* A name is short: the two halves share a line, on a phone too. */}
      <div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.common.firstName} name="firstName" autoComplete="given-name" required error={fields.firstName} />
          <Field label={t.common.lastName} name="lastName" autoComplete="family-name" required error={fields.lastName} />
        </div>
        <p className="hint">{t.join.nameNote}</p>
      </div>

      <Field
        label={t.common.phone}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="555 12 34 56"
        required
        error={fields.phone}
      />

      <Field
        label={t.join.facebook}
        name="facebookUrl"
        type="url"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="facebook.com/your.name"
        required
        hint={t.join.facebookHint}
        error={fields.facebookUrl}
      />

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

      <PhotoPicker value={photo} onChange={setPhoto} error={fields.photo} />

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
        {busy ? t.join.submitting : t.join.submit}
      </button>

      <p className="text-center">
        {t.join.haveAccount}{" "}
        <Link href="/login" className="link">
          {t.common.signIn}
        </Link>
      </p>
    </form>
  );
}
