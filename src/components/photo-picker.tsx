"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/i18n/provider";
import { shrinkPhoto } from "@/lib/photo";
import { FieldLabel } from "./field";

/** Picks a face photo, shrinks it on the device and hands back a small data URL. */
export function PhotoPicker({
  value,
  onChange,
  error,
  bare = false,
}: {
  /** A data URL, or a URL of the photo already on the account. */
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  error?: string;
  /** Without its own label: for a place that already says whose photo this is. */
  bare?: boolean;
}) {
  const { t, error: errorText } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  // The photo on the account that would not load. Remembered by its address, so a new photo
  // gets its own chance.
  const [broken, setBroken] = useState<string | null>(null);
  const shown = value && value !== broken ? value : null;

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
      {!bare && (
        <p className="label">
          <FieldLabel optional>{t.join.photo}</FieldLabel>
        </p>
      )}
      <div className="flex items-center gap-4">
        <div className="grid h-20 w-20 flex-none place-items-center overflow-hidden rounded-full border-2 border-ink bg-qr">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local data URL or an authenticated API image
            <img src={shown} alt="" className="h-full w-full object-cover" onError={() => setBroken(shown)} />
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
      {(failed || error) && <p className="field-error">{errorText(error ?? "photo_invalid")}</p>}
    </div>
  );
}
