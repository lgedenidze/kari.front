"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useI18n } from "@/i18n/provider";
import { EyeIcon, EyeOffIcon } from "./icons";

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
  // A password is typed once, on a phone, with no second field to catch a slip — and there is
  // no "forgot password" to fall back on. So it can be looked at before it is sent.
  const isPassword = input.type === "password";
  const [shown, setShown] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="label">
        {/* Two pieces that each stay whole: a narrow screen breaks between them, not inside. */}
        <span className="inline-block">{label}</span>
        {optional && <span className="ml-1.5 inline-block font-normal text-paper-soft">({t.common.optional})</span>}
      </label>
      {isPassword ? (
        <div className="relative">
          <input
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            {...input}
            className="input pr-12"
            type={shown ? "text" : "password"}
          />
          <button
            type="button"
            onClick={() => setShown((now) => !now)}
            aria-pressed={shown}
            aria-label={shown ? t.common.hidePassword : t.common.showPassword}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-[12px] opacity-70 hover:opacity-100"
          >
            {shown ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      ) : (
        <input id={id} className="input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      )}
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
