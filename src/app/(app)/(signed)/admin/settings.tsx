"use client";

import { useEffect, useState, type FormEvent } from "react";
import { FormError } from "@/components/field";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import type { Settings } from "@/lib/types";

export function SettingsTab() {
  const { t, error: errorText } = useI18n();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Settings>("/admin/settings")
      .then((loaded) => {
        setSettings(loaded);
        setDays(loaded.openDays);
      })
      .catch((error) => setFailure(isApiError(error) ? error.code : "server_error"));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const number = (name: string) => Number(form.get(name));
    setBusy(true);
    setSaved(false);
    setFields({});
    setFailure(null);
    try {
      const updated = await api.put<Settings>("/admin/settings", {
        openDays: days,
        doorsOpen: form.get("doorsOpen"),
        doorsClose: form.get("doorsClose"),
        cutoffHour: number("cutoffHour"),
        capacity: number("capacity"),
        defaultInviteQuota: number("defaultInviteQuota"),
        regularAfterVisits: number("regularAfterVisits"),
      });
      setSettings(updated);
      setDays(updated.openDays);
      setSaved(true);
    } catch (error) {
      if (isApiError(error) && Object.keys(error.fields).length > 0) setFields(error.fields);
      else setFailure(isApiError(error) ? error.code : "server_error");
    }
    setBusy(false);
  }

  if (!settings) return failure ? <FormError code={failure} /> : <p className="text-desk-soft">{t.common.loading}</p>;

  const weekdays = t.admin.weekdays.split(",");
  // Monday first, as calendars are read here; the API numbers days from Sunday = 0.
  const order = [1, 2, 3, 4, 5, 6, 0];
  const toggle = (day: number) => setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]));
  const fieldError = (name: string) => fields[name] && <span className="field-error block">{errorText(fields[name])}</span>;

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-7">
      <h1 className="title">{t.admin.navSettings}</h1>
      {failure && <FormError code={failure} />}

      <fieldset>
        <legend className="label">{t.admin.openOn}</legend>
        <div className="flex flex-wrap gap-2">
          {order.map((day) => (
            <button
              key={day}
              type="button"
              aria-pressed={days.includes(day)}
              onClick={() => toggle(day)}
              className={`min-h-11 min-w-14 rounded-full border-2 border-ink px-3 font-bold ${days.includes(day) ? "bg-ink text-paper-light" : "bg-white"}`}
            >
              {weekdays[day]}
            </button>
          ))}
        </div>
        {fieldError("openDays")}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="label">{t.admin.doorsFrom}</span>
          <input name="doorsOpen" type="time" required defaultValue={settings.doorsOpen} className="input" />
          {fieldError("doorsOpen")}
        </label>
        <label className="block">
          <span className="label">{t.admin.doorsTo}</span>
          <input name="doorsClose" type="time" required defaultValue={settings.doorsClose} className="input" />
          {fieldError("doorsClose")}
        </label>
        <label className="block">
          <span className="label">{t.admin.cutoff}</span>
          <select name="cutoffHour" defaultValue={settings.cutoffHour} className="input">
            {Array.from({ length: 13 }, (_, hour) => (
              <option key={hour} value={hour}>
                {String(hour).padStart(2, "0")}:00
              </option>
            ))}
          </select>
          <span className="hint block">{t.admin.cutoffHint}</span>
          {fieldError("cutoffHour")}
        </label>
        <label className="block">
          <span className="label">{t.admin.capacity}</span>
          <input name="capacity" type="number" min={1} inputMode="numeric" required defaultValue={settings.capacity} className="input" />
          {fieldError("capacity")}
        </label>
        <label className="block">
          <span className="label">{t.admin.defaultQuota}</span>
          <input
            name="defaultInviteQuota"
            type="number"
            min={0}
            max={50}
            inputMode="numeric"
            required
            defaultValue={settings.defaultInviteQuota}
            className="input"
          />
          {fieldError("defaultInviteQuota")}
        </label>
        <label className="block">
          <span className="label">{t.admin.regularAfter}</span>
          <input
            name="regularAfterVisits"
            type="number"
            min={0}
            inputMode="numeric"
            required
            defaultValue={settings.regularAfterVisits}
            className="input"
          />
          {fieldError("regularAfterVisits")}
        </label>
      </div>

      <button type="submit" className="btn btn-ink btn-big px-8" disabled={busy} aria-live="polite">
        {saved ? t.common.saved : t.common.save}
      </button>
    </form>
  );
}
