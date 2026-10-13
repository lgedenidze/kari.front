"use client";

import { useCallback, useState, type FormEvent } from "react";
import { FormError } from "@/components/field";
import { usePoll } from "@/components/me";
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
  const [nights, setNights] = useState<NightInfo[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
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
  // Paused while a form is open, so typing is never overwritten.
  usePoll(load, 60000, editing === null && !adding);

  const done = () => {
    setEditing(null);
    setAdding(false);
    void load();
  };

  if (!nights) {
    return (
      <div className="space-y-5">
        <h1 className="text-5xl">{t.admin.navNights}</h1>
        {failure ? <FormError code={failure} /> : <p className="text-desk-soft">{t.common.loading}</p>}
      </div>
    );
  }

  const special = nights.filter((n) => n.overridden);
  const schedule = nights.slice(0, SCHEDULE_NIGHTS);
  const hours = (info: NightInfo) => (info.open ? `${info.doorsOpen}–${info.doorsClose}` : t.admin.nightClosed);

  return (
    <div className="space-y-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl">{t.admin.navNights}</h1>
          <p className="mt-2 max-w-xl text-desk-soft">{t.admin.nightAddIntro}</p>
        </div>
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
                    <button type="button" className="btn btn-ink btn-small mt-4" onClick={() => setEditing(info.night)}>
                      {t.admin.nightEdit}
                    </button>
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
        <p className="mt-1 max-w-xl text-desk-soft">{t.admin.nightsIntro}</p>
        <ul className="mt-3 divide-y divide-desk-line rounded-2xl border-2 border-desk-line bg-white">
          {schedule.map((info) => (
            <li key={info.night} className="px-4 py-3.5">
              {editing === info.night && !info.overridden ? (
                <NightForm nights={nights} night={info.night} onSaved={done} onCancel={() => setEditing(null)} />
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
                    <span className={`chip ${info.open ? "text-stamp-green" : "text-desk-soft"}`}>{hours(info)}</span>
                    <button type="button" className="btn btn-line btn-small" onClick={() => setEditing(info.night)}>
                      {t.admin.nightEdit}
                    </button>
                  </div>
                </div>
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
