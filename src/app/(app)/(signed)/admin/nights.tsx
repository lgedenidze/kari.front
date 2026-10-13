"use client";

import { useState, type FormEvent } from "react";
import { FormError } from "@/components/field";
import { RowsSkeleton } from "@/components/loading";
import { useLive } from "@/components/use-live";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import type { NightInfo } from "@/lib/types";

const SCHEDULE_NIGHTS = 21;

/**
 * Nights. Two jobs, kept apart:
 *  - "Add a night" names any date — next Friday or New Year's Eve — closes it, or changes its
 *    capacity. Those nights are listed first, by name.
 *  - Below is the plain schedule for the next three weeks, where any single night can be edited.
 */
export function NightsTab() {
  const { t, night } = useI18n();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeFailure, setRemoveFailure] = useState<string | null>(null);

  // Asked now, and again each minute: a night rolls over at the cutoff while this tab is open.
  // Paused while a form or a question is open, so nothing moves under the admin's finger.
  const live = useLive<NightInfo[]>("/admin/nights", { every: 60000, enabled: editing === null && !adding && deleting === null });
  const nights = live.data;
  const load = live.reload;
  const failure = removeFailure ?? live.failure;

  const done = () => {
    setEditing(null);
    setAdding(false);
    void load();
  };

  // Deleting a night removes its name and its changes; the weekly schedule decides it again.
  async function remove(nightToDelete: string) {
    setBusy(true);
    setRemoveFailure(null);
    try {
      await api.delete(`/admin/nights/${nightToDelete}`);
      setDeleting(null);
      await load();
    } catch (error) {
      setRemoveFailure(isApiError(error) ? error.code : "server_error");
    }
    setBusy(false);
  }

  if (!nights) {
    return (
      <div className="space-y-5">
        <h1 className="title">{t.admin.navNights}</h1>
        {failure ? <FormError code={failure} /> : <RowsSkeleton rows={4} />}
      </div>
    );
  }

  const special = nights.filter((n) => n.overridden);
  const schedule = nights.slice(0, SCHEDULE_NIGHTS);
  const hours = (info: NightInfo) => (info.open ? `${info.doorsOpen}–${info.doorsClose}` : t.admin.nightClosed);

  return (
    <div className="space-y-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="title">{t.admin.navNights}</h1>
        {!adding && (
          <button type="button" className="btn btn-ink btn-big px-7" onClick={() => setAdding(true)}>
            {t.admin.nightAdd}
          </button>
        )}
      </div>

      {failure && <FormError code={failure} />}

      {adding && (
        <div className="paper p-5">
          <h2 className="mb-4 text-3xl">{t.admin.nightAdd}</h2>
          <NightForm nights={nights} pickDate onSaved={done} onCancel={() => setAdding(false)} />
        </div>
      )}

      <section aria-labelledby="special-nights">
        <h2 id="special-nights" className="text-2xl">
          {t.admin.nightSpecial}
        </h2>
        {special.length === 0 ? (
          <p className="mt-3 rounded-2xl border-2 border-dashed border-desk-line p-6 text-center text-desk-soft">
            {t.admin.nightNoSpecial}
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {special.map((info) => (
              <li key={info.night} className="paper p-5">
                {editing === info.night ? (
                  <NightForm nights={nights} night={info.night} onSaved={done} onCancel={() => setEditing(null)} />
                ) : (
                  <>
                    <p className="text-sm font-bold text-paper-soft">{night(info.night, "long")}</p>
                    <p className="display mt-1 break-words text-3xl">{info.title ?? hours(info)}</p>
                    {info.note && <p className="mt-1 text-paper-soft">{info.note}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`chip ${info.open ? "text-stamp-green" : "text-stamp-red"}`}>{hours(info)}</span>
                      <span className="chip tabular">
                        {t.admin.capacity}: {info.capacity}
                      </span>
                    </div>
                    {deleting === info.night ? (
                      // Deleting asks once, in place: what it does, and the two ways out.
                      <div className="mt-4 rounded-xl border-2 border-stamp-red bg-qr p-3" role="alertdialog" aria-label={t.admin.nightDeleteConfirm}>
                        <p className="font-semibold">{t.admin.nightDeleteConfirm}</p>
                        <div className="mt-3 flex gap-2">
                          <button type="button" className="btn btn-danger btn-small flex-1" disabled={busy} onClick={() => void remove(info.night)}>
                            {t.admin.nightDeleteYes}
                          </button>
                          <button type="button" className="btn btn-line btn-small flex-1" disabled={busy} onClick={() => setDeleting(null)}>
                            {t.invites.keep}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" className="btn btn-ink btn-small" onClick={() => setEditing(info.night)}>
                          {t.admin.nightEdit}
                        </button>
                        <button type="button" className="btn btn-line btn-small text-stamp-red" onClick={() => setDeleting(info.night)}>
                          {t.admin.nightDelete}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="schedule">
        <h2 id="schedule" className="text-2xl">
          {t.admin.nightSchedule}
        </h2>
        <ul className="mt-3 divide-y divide-desk-line rounded-2xl border-2 border-desk-line bg-white">
          {schedule.map((info) => (
            <li key={info.night}>
              {editing === info.night && !info.overridden ? (
                <div className="px-4 py-3.5">
                  <NightForm nights={nights} night={info.night} onSaved={done} onCancel={() => setEditing(null)} />
                </div>
              ) : (
                // The whole row opens the night, as a person's row opens the person: twenty-one
                // "Edit" buttons in a column were twenty-one too many. Two lines that each stay
                // whole — the date with the night's name, then its hours. On a phone the date is
                // the short one; the long one broke into three lines and ran under the hours.
                <button
                  type="button"
                  onClick={() => setEditing(info.night)}
                  aria-label={`${t.admin.nightEdit}: ${night(info.night, "long")}`}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-desk active:bg-desk"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold">
                      <span className="sm:hidden">{night(info.night)}</span>
                      <span className="hidden sm:inline">{night(info.night, "long")}</span>
                      {info.title && <span className="font-normal">, {info.title}</span>}
                    </span>
                    <span className="block truncate text-sm">
                      <span className={`tabular font-semibold ${info.open ? "text-stamp-green" : "text-desk-soft"}`}>{hours(info)}</span>
                      {info.note && <span className="text-desk-soft">, {info.note}</span>}
                    </span>
                  </span>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-desk-soft">
                    <path d="m9 5.5 6.5 6.5L9 18.5" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * Names, closes or resizes one night. With `pickDate` the admin chooses the date first — any
 * date from tonight on, not only the three weeks listed.
 */
function NightForm({
  nights,
  night: fixedNight,
  pickDate = false,
  onSaved,
  onCancel,
}: {
  nights: NightInfo[];
  night?: string;
  pickDate?: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t, night: formatNight } = useI18n();
  const tonight = nights[0].night;
  const [date, setDate] = useState(fixedNight ?? tonight);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // What is already known about the chosen date, so picking a named night shows its name.
  const known = nights.find((n) => n.night === date);
  const [closed, setClosed] = useState(known ? !known.open : false);
  const pick = (next: string) => {
    setDate(next);
    const info = nights.find((n) => n.night === next);
    setClosed(info ? !info.open : false);
  };

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setFailure(null);
    try {
      await action();
      onSaved();
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
      api.put<NightInfo>(`/admin/nights/${date}`, {
        closed,
        title: form.get("title"),
        note: form.get("note"),
        capacity: capacity === "" ? null : Number(capacity),
      }),
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {failure && <FormError code={failure} />}

      {pickDate ? (
        <label className="block max-w-[15rem]">
          <span className="label">{t.admin.nightDate}</span>
          <input type="date" required min={tonight} value={date} onChange={(event) => pick(event.target.value)} className="input" />
          <span className="hint block">{date ? formatNight(date, "long") : ""}</span>
        </label>
      ) : (
        <p className="text-lg font-bold">{formatNight(date, "long")}</p>
      )}

      {/* Keyed by date: choosing another date starts these fields from that night's own
          values. The date field itself stays put, so it keeps focus while a date is typed. */}
      <div key={date} className="space-y-4">
        <label className="block">
          <span className="label">{t.admin.nightTitle}</span>
          <input name="title" maxLength={80} defaultValue={known?.title ?? ""} className="input" />
        </label>

        <div className="flex gap-2" role="group" aria-label={t.admin.colStatus}>
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
            <span className="label">{t.admin.nightNote}</span>
            <input name="note" maxLength={300} defaultValue={known?.note ?? ""} className="input" />
          </label>
          <label className="block">
            <span className="label">{t.admin.nightCapacity}</span>
            <input
              name="capacity"
              type="number"
              min={1}
              inputMode="numeric"
              defaultValue={known?.overridden ? known.capacity : ""}
              placeholder={String(known?.capacity ?? nights[0].capacity)}
              className="input"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-ink" disabled={busy || !date}>
          {t.common.save}
        </button>
        {known?.overridden && (
          <button type="button" className="btn btn-line" disabled={busy} onClick={() => void run(() => api.delete(`/admin/nights/${date}`))}>
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
