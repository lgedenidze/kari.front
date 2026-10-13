"use client";

import { useEffect, useRef } from "react";
import { weekdayOf } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import type { InviteNight } from "@/lib/types";

/**
 * Picks a night: one row of the nights the bar is open, the nearest first, to tap.
 *
 * It was a two-week calendar with a second list of named nights under it. That was most of a
 * screen to answer a question whose answer is nearly always "tonight" or "this Friday", and it
 * stood between the member and the one thing they came to type — the guest's name. A row
 * holds the same nights in one line, and a closed night is simply not on it.
 *
 * Every night is the same small block: the weekday over the day of the month, in the same
 * place on each, so the row reads as a run of dates. A night the bar has named is that block
 * as the stub of a ticket, torn along a dashed line, with its name on the ticket beside it —
 * in the headline cut, on up to two lines, with room. (The name used to be a third, smaller
 * line squeezed under the number: it was cut short, and it pushed that night's date out of
 * line with its neighbours.)
 *
 * A night with no invites left stays in the row, drawn as an empty outline. It can still be
 * tapped, because the line under the row is where it says why there is nothing to send.
 *
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
  const { t, fill, night: formatNight } = useI18n();
  const row = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // The chosen night is brought to the middle of the row — by moving the row only, never the
  // page. At once on arrival, and smoothly after a tap.
  useEffect(() => {
    const strip = row.current;
    const chosen = strip?.querySelector<HTMLElement>("[aria-pressed='true']");
    if (!strip || !chosen) return;
    const left = chosen.offsetLeft - (strip.clientWidth - chosen.offsetWidth) / 2;
    strip.scrollTo({ left, behavior: first.current ? "auto" : "smooth" });
    first.current = false;
  }, [value]);

  if (nights.length === 0) return null;

  const tonight = nights[0].night;
  const open = nights.filter((n) => n.open);
  const selected = nights.find((n) => n.night === value);
  // Sunday-first names, as the API numbers days.
  const names = t.admin.weekdays.split(",");

  const left = (remaining: number) =>
    remaining === 0 ? t.invites.invitesNone : remaining === 1 ? t.invites.invitesLeftOne : fill(t.invites.invitesLeftMany, { n: remaining });

  return (
    <div>
      {/* The row runs to the card's edges and fades at the far one: plainly more than fits. */}
      <div ref={row} className="scroll-row -mx-5 flex gap-2 px-5 py-1" role="group" aria-label={t.invites.night}>
        {open.map((n) => {
          const chosen = n.night === value;
          const gone = n.remaining === 0;
          return (
            <button
              key={n.night}
              type="button"
              aria-pressed={chosen}
              aria-label={[formatNight(n.night, "long"), n.title, left(n.remaining)].filter(Boolean).join(", ")}
              onClick={() => onChange(n.night)}
              className={`flex h-[4.25rem] flex-none items-stretch overflow-hidden rounded-2xl border-2 transition-colors ${
                chosen
                  ? gone
                    ? "border-dashed border-ink bg-paper-light text-ink-deep"
                    : "border-ink bg-ink text-paper-light"
                  : gone
                    ? "border-dashed border-paper-line text-paper-soft"
                    : "border-ink bg-qr text-ink-deep active:bg-paper-light"
              }`}
            >
              <span className="flex w-[3.5rem] flex-none flex-col items-center justify-center">
                <span className={`text-[0.72rem] font-bold leading-[1.5] ${chosen && !gone ? "text-ink-soft" : "text-paper-soft"}`}>
                  {n.night === tonight ? t.invites.today : names[weekdayOf(n.night)]}
                </span>
                <span className="display tabular text-[1.75rem] leading-none">{Number(n.night.slice(8))}</span>
              </span>
              {n.title && (
                <span
                  className={`flex max-w-[8.5rem] items-center border-l-2 border-dashed py-1.5 pl-3 pr-3.5 text-left ${
                    chosen && !gone ? "border-ink-line" : "border-paper-line"
                  }`}
                >
                  {/* Two lines at most, and a line tall enough for Georgian tails (ვ, ფ, პ). */}
                  <span className="display line-clamp-2 break-words text-[1.05rem] leading-[1.3]">{n.title}</span>
                </span>
              )}
            </button>
          );
        })}
        {/* Room for the last night to clear the fade. */}
        <span className="w-6 flex-none" aria-hidden="true" />
      </div>

      {/* What was picked, said in full: the date, its name, its note, and what is left. */}
      {selected && (
        <div className="mt-2 text-sm" aria-live="polite">
          <p className="font-bold">
            {formatNight(selected.night, "long")}
            {selected.title && `, ${selected.title}`}
          </p>
          <p className={selected.remaining === 0 ? "font-semibold text-stamp-red" : "text-paper-soft"}>
            {/* A note may or may not end in a full stop; one is put after it either way. */}
            {selected.note && `${selected.note.replace(/[.\s]+$/, "")}. `}
            {left(selected.remaining)}
          </p>
        </div>
      )}
    </div>
  );
}
