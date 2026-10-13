"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/i18n/provider";
import { shrinkPhoto } from "@/lib/photo";

/** Picks a face photo, shrinks it on the device and hands back a small data URL. */
export function PhotoPicker({
  value,
  onChange,
  error,
}: {
  /** A data URL, or a URL of the photo already on the account. */
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  error?: string;
}) {
  const { t, error: errorText } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      onChange(await shrinkPhoto(file));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div>
      <p className="label">
        {t.join.photo} <span className="ml-1.5 font-normal text-paper-soft">({t.common.optional})</span>
      </p>
      <div className="flex items-center gap-4">
        <div className="grid h-20 w-20 flex-none place-items-center overflow-hidden rounded-full border-2 border-ink bg-qr">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local data URL or an authenticated API image
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="9" r="4" />
              <path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" strokeLinecap="round" />
            </svg>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-line btn-small" onClick={() => input.current?.click()}>
            {value ? t.join.changePhoto : t.join.addPhoto}
          </button>
          {value && (
            <button type="button" className="btn btn-small" onClick={() => onChange(null)}>
              {t.join.removePhoto}
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            void pick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {failed || error ? (
        <p className="field-error">{errorText(error ?? "photo_invalid")}</p>
      ) : (
        <p className="hint">{t.join.photoHint}</p>
      )}
    </div>
  );
}
