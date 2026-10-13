"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormError } from "@/components/field";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import type { Me } from "@/lib/types";

export function LoginForm({ next }: { next: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFailure(null);
    try {
      await api.post<Me>("/auth/login", { phone: form.get("phone"), password: form.get("password") });
      router.push(next);
      router.refresh();
    } catch (error) {
      setFailure(isApiError(error) ? error.code : "server_error");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="paper rise space-y-5 p-5 sm:p-7">
      <h1 className="text-4xl">{t.login.title}</h1>

      <FormError code={failure} />

      <Field
        label={t.common.phone}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="username"
        placeholder="555 12 34 56"
        required
      />
      <Field label={t.common.password} name="password" type="password" autoComplete="current-password" required />

      <button type="submit" className="btn btn-ink btn-big w-full" disabled={busy}>
        {busy ? t.login.submitting : t.login.submit}
      </button>

      <p className="text-sm text-paper-soft">{t.login.forgot}</p>

      <p className="text-center">
        {t.login.noAccount}{" "}
        <Link href="/join" className="link">
          {t.common.requestAccess}
        </Link>
      </p>
    </form>
  );
}
