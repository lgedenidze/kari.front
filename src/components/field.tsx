"use client";

import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type RefObject } from "react";
import { useI18n } from "@/i18n/provider";
import { EyeIcon, EyeOffIcon } from "./icons";

/**
 * The name of a field, and beside it — small, at the far end of the line — that it may be left
 * empty. Said once per optional field, in the same place, so a form reads as "these, and
 * maybe those" at a glance.
 */
export function FieldLabel({ children, optional = false }: { children: ReactNode; optional?: boolean }) {
  const { t } = useI18n();
  return (
    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
      <span>{children}</span>
      {optional && <span className="text-[0.8rem] font-normal text-paper-soft">{t.common.optional}</span>}
    </span>
  );
}

/**
 * After a form comes back with mistakes, goes to the first field that has one. A long form is
 * sent from its last line, and the field that needs fixing is often a screen above it: without
 * this the button seems to do nothing.
 */
export function useFirstMistake(form: RefObject<HTMLFormElement | null>, fields: Record<string, string>) {
  useEffect(() => {
    if (Object.keys(fields).length === 0) return;
    const first = form.current?.querySelector<HTMLElement>("[aria-invalid='true']");
    if (!first) return;
    // Scrolled by hand: a phone may refuse to raise its keyboard here, but it must still show
    // the field.
    first.focus({ preventScroll: true });
    first.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [form, fields]);
}

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
  // Only one of the two is on screen at a time: the error takes the hint's place.
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  // A password is typed once, on a phone, with no second field to catch a slip — and there is
  // no "forgot password" to fall back on. So it can be looked at before it is sent.
  const isPassword = input.type === "password";
  const [shown, setShown] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="label">
        <FieldLabel optional={optional}>{label}</FieldLabel>
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

/**
 * The message shown above a form when a request fails as a whole. It brings itself into view:
 * the tap that caused it was usually at the foot of the form, a screen below. Already in view,
 * it does not move anything — and "check the marked fields" leaves the moving to the field.
 */
export function FormError({ code }: { code: string | null }) {
  const { error } = useI18n();
  const notice = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (code && code !== "validation") notice.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [code]);
  if (!code) return null;
  return (
    <p ref={notice} role="alert" className="notice-error">
      {error(code)}
    </p>
  );
}
