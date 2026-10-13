"use client";

import { formatMonth, weekdayOf } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import type { InviteNight } from "@/lib/types";

/**
 * Picks a night from the next two weeks, laid out as a calendar: seven columns, Monday first.
 * Every night is on it — open ones can be chosen, closed and used-up ones are visibly not —
 * so a member reads the fortnight at a glance instead of scrolling a strip of dates.
 * The API supplies the nights; nothing here works out what "tonight" is.
 */
export function NightPicker({
  nights,
  value,
  onChange,
}: {
  nights: InviteNight[];
  value: string;
  onChange: (night: string) => void;
}) {
  const { t, fill, lang, night: formatNight } = useI18n();
  if (nights.length === 0) return null;

  const first = nights[0];
  const last = nights[nights.length - 1];
  const selected = nights.find((n) => n.night === value);
  const special = nights.filter((n) => n.open && n.title);

  // Sunday-first names from the dictionary, turned Monday-first to match the grid.
  const names = t.admin.weekdays.split(",");
  const columns = [1, 2, 3, 4, 5, 6, 0].map((day) => names[day]);
  const leading = (weekdayOf(first.night) + 6) % 7;

  const firstMonth = formatMonth(first.night, lang);
  const lastMonth = formatMonth(last.night, lang);
  const heading = firstMonth === lastMonth ? firstMonth : `${firstMonth} – ${lastMonth}`;

  const describe = (n: InviteNight) =>
    [formatNight(n.night, "long"), n.title, !n.open ? t.admin.nightClosed : left(n.remaining)].filter(Boolean).join(", ");

  const left = (remaining: number) =>
    remaining === 0 ? t.invites.invitesNone : remaining === 1 ? t.invites.invitesLeftOne : fill(t.invites.invitesLeftMany, { n: remaining });

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border-2 border-ink bg-qr p-3">
        <p className="display px-1 pb-2 text-xl">{heading}</p>

        <div className="grid grid-cols-7 gap-1 text-center" role="group" aria-label={t.invites.night}>
          {columns.map((name) => (
            <span key={name} className="pb-1 text-[0.7rem] font-bold text-paper-soft" aria-hidden="true">
              {name}
            </span>
          ))}

          {Array.from({ length: leading }, (_, index) => (
            <span key={`blank-${index}`} />
          ))}

          {nights.map((n) => {
            const day = Number(n.night.slice(8));
            const chosen = n.night === value;
            const available = n.open && n.remaining > 0;
            return (
              <button
                key={n.night}
                type="button"
                disabled={!available}
                aria-pressed={chosen}
                aria-label={describe(n)}
                onClick={() => onChange(n.night)}
                className={`relative grid h-12 place-items-center rounded-xl border-2 text-base font-extrabold transition-colors ${
                  chosen
                    ? "border-ink bg-ink text-paper-light"
                    : available
                      ? "border-ink bg-white text-ink-deep hover:bg-paper-light"
                      : n.open
                        ? "border-paper-line text-paper-soft"
                        : "border-dashed border-paper-line text-paper-soft line-through decoration-2"
                }`}
              >
                <span className="tabular">{day}</span>
                {/* a named night carries a mark */}
                {n.open && n.title && (
                  <span
                    aria-hidden="true"
                    className={`absolute right-1 top-1 h-2 w-2 rounded-full ${chosen ? "bg-paper" : "bg-stamp-blue"}`}
                  />
                )}
                {/* tonight is underlined */}
                {n.night === first.night && (
                  <span
                    aria-hidden="true"
                    className={`absolute bottom-1 h-[3px] w-4 rounded-full ${chosen ? "bg-paper" : "bg-ink"}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* What was picked, said in full: the date, its name if it has one, and what is left. */}
      {selected && (
        <div className="rounded-2xl bg-ink px-4 py-3 text-paper-light" aria-live="polite">
          <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-ink-soft">
            {formatNight(selected.night, "long")}
            {selected.night === first.night && <span className="chip text-paper">{t.invites.tonight}</span>}
          </p>
          {selected.title && <p className="display mt-1 text-2xl text-paper">{selected.title}</p>}
          {selected.note && <p className="mt-0.5 text-sm text-ink-soft">{selected.note}</p>}
          <p className="mt-1 font-bold">{left(selected.remaining)}</p>
        </div>
      )}

      {/* Named nights are what people actually look for, so they are also listed by name. */}
      {special.length > 0 && (
        <div>
          <p className="label">{t.invites.specialNights}</p>
          <ul className="space-y-1.5">
            {special.map((n) => {
              const chosen = n.night === value;
              return (
                <li key={n.night}>
                  <button
                    type="button"
                    disabled={n.remaining === 0}
                    aria-pressed={chosen}
                    onClick={() => onChange(n.night)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 border-ink px-3.5 py-2.5 text-left disabled:opacity-50 ${
                      chosen ? "bg-ink text-paper-light" : "bg-white hover:bg-paper-light"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-extrabold">{n.title}</span>
                      <span className={`block text-sm ${chosen ? "text-ink-soft" : "text-paper-soft"}`}>{formatNight(n.night, "long")}</span>
                    </span>
                    <span className="tabular flex-none text-sm font-bold">{fill(t.invites.left, { n: n.remaining })}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
