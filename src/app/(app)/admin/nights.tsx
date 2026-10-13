"use client";

import { useCallback, useState, type FormEvent } from "react";
import { FormError } from "@/components/field";
import { usePoll } from "@/components/me";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import type { NightInfo } from "@/lib/types";

/** The next three weeks. The schedule decides each night unless it is changed here. */
export function NightsTab() {
  const { t, night } = useI18n();
  const [nights, setNights] = useState<NightInfo[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setNights(await api.get<NightInfo[]>("/admin/nights"));
      setFailure(null);
    } catch (error) {
      setFailure(isApiError(error) ? error.code : "server_error");
    }
  }, []);

  // Loads now, and again each minute: a night rolls over at the cutoff while this tab is open.
  usePoll(load, 60000, editing === null);

  const replace = (updated: NightInfo) => {
    setNights((current) => current?.map((n) => (n.night === updated.night ? updated : n)) ?? null);
    setEditing(null);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-5xl">{t.admin.navNights}</h1>
        <p className="mt-2 max-w-xl text-desk-soft">{t.admin.nightsIntro}</p>
      </div>
      {failure && <FormError code={failure} />}
      {!nights ? (
        <p className="text-desk-soft">{t.common.loading}</p>
      ) : (
        <ul className="divide-y divide-desk-line rounded-2xl border-2 border-desk-line bg-white">
          {nights.map((info) => (
            <li key={info.night} className="px-4 py-3.5">
              {editing === info.night ? (
                <NightForm info={info} onSaved={replace} onCancel={() => setEditing(null)} />
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">
                      {night(info.night, "long")}
                      {info.title && <span className="font-normal">, {info.title}</span>}
                    </p>
                    {info.note && <p className="truncate text-sm text-desk-soft">{info.note}</p>}
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <span className={`chip ${info.open ? "text-stamp-green" : "text-desk-soft"}`}>
                      {info.open ? `${info.doorsOpen}–${info.doorsClose}` : t.admin.nightClosed}
                    </span>
                    <button type="button" className="btn btn-line btn-small" onClick={() => setEditing(info.night)}>
                      {t.admin.nightEdit}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NightForm({ info, onSaved, onCancel }: { info: NightInfo; onSaved: (info: NightInfo) => void; onCancel: () => void }) {
  const { t, night } = useI18n();
  const [closed, setClosed] = useState(!info.open);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function run(action: () => Promise<NightInfo>) {
    setBusy(true);
    setFailure(null);
    try {
      onSaved(await action());
    } catch (error) {
      setFailure(isApiError(error) ? (Object.values(error.fields)[0] ?? error.code) : "server_error");
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const capacity = String(form.get("capacity") ?? "").trim();
    void run(() =>
      api.put<NightInfo>(`/admin/nights/${info.night}`, {
        closed,
        title: form.get("title"),
        note: form.get("note"),
        capacity: capacity === "" ? null : Number(capacity),
      }),
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 py-1">
      <p className="text-lg font-bold">{night(info.night, "long")}</p>
      {failure && <FormError code={failure} />}

      <div className="flex gap-2" role="group">
        {[false, true].map((value) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={closed === value}
            onClick={() => setClosed(value)}
            className={`min-h-11 flex-1 rounded-full border-2 border-ink px-4 font-bold ${closed === value ? "bg-ink text-paper-light" : "bg-white"}`}
          >
            {value ? t.admin.nightClosed : t.admin.nightOpen}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">{t.admin.nightTitle}</span>
          <input name="title" maxLength={80} defaultValue={info.title ?? ""} className="input" />
        </label>
        <label className="block">
          <span className="label">{t.admin.nightCapacity}</span>
          <input
            name="capacity"
            type="number"
            min={1}
            inputMode="numeric"
            defaultValue={info.overridden ? info.capacity : ""}
            placeholder={String(info.capacity)}
            className="input"
          />
        </label>
      </div>
      <label className="block">
        <span className="label">{t.admin.nightNote}</span>
        <input name="note" maxLength={300} defaultValue={info.note ?? ""} className="input" />
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-ink" disabled={busy}>
          {t.common.save}
        </button>
        {info.overridden && (
          <button
            type="button"
            className="btn btn-line"
            disabled={busy}
            onClick={() => void run(() => api.delete<NightInfo>(`/admin/nights/${info.night}`))}
          >
            {t.admin.nightReset}
          </button>
        )}
        <button type="button" className="btn" onClick={onCancel}>
          {t.common.cancel}
        </button>
      </div>
    </form>
  );
}
