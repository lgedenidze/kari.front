"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { useI18n } from "@/i18n/provider";

/** A labelled input with its hint and its error, wired together for screen readers. */
export function Field({
  label,
  hint,
  error,
  optional,
  ...input
}: {
  label: string;
  hint?: ReactNode;
  /** An API field-error code, e.g. "phone_invalid". */
  error?: string;
  optional?: boolean;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const { t, error: errorText } = useI18n();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
        {optional && <span className="ml-1.5 font-normal text-paper-soft">({t.common.optional})</span>}
      </label>
      <input id={id} className="input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {errorText(error)}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="hint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** The message shown above a form when a request fails as a whole. */
export function FormError({ code }: { code: string | null }) {
  const { error } = useI18n();
  if (!code) return null;
  return (
    <p role="alert" className="notice-error">
      {error(code)}
    </p>
  );
}
