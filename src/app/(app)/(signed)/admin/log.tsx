"use client";

import { useState } from "react";
import { FormError } from "@/components/field";
import { RowsSkeleton } from "@/components/loading";
import { useLive } from "@/components/use-live";
import { useI18n } from "@/i18n/provider";
import type { EntriesResponse } from "@/lib/types";

/** The day before or after a chosen date. Plain arithmetic on the date; no clock is asked. */
function shift(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Every decision made at the door on one night: who, when, what the scanner said, who decided.
 * `night` is the night to open on, when the tab is opened from a night on the first tab.
 */
export function LogTab({ night: opened = "" }: { night?: string }) {
  const { t, fill, night, time } = useI18n();
  const [picked, setPicked] = useState(opened);
  // One night at a time. Each night is remembered, so going back to one is immediate.
  const { data, failure } = useLive<EntriesResponse>(picked ? `/admin/entries?night=${picked}` : "/admin/entries");
  const shown = picked || data?.night || "";

  return (
    <div className="space-y-5">
      <h1 className="title">{t.admin.navLog}</h1>

      {/* One night back, one night on: the usual question is "and the night before?". The
          date field is still there for any other night. */}
      <div className="flex items-end gap-2">
        <button
          type="button"
          className="btn btn-line !min-h-12 w-12 flex-none !px-0"
          aria-label={t.admin.previous}
          disabled={!shown}
          onClick={() => setPicked(shift(shown, -1))}
        >
          <Arrow back />
        </button>
        <label className="block min-w-0 max-w-[12rem] flex-1">
          <span className="label">{t.invites.night}</span>
          {/* The API answers with tonight first; the picker then starts from that date. */}
          <input type="date" className="input" value={shown} onChange={(event) => setPicked(event.target.value)} />
        </label>
        <button
          type="button"
          className="btn btn-line !min-h-12 w-12 flex-none !px-0"
          aria-label={t.admin.next}
          disabled={!shown}
          onClick={() => setPicked(shift(shown, 1))}
        >
          <Arrow />
        </button>
      </div>

      {failure && <FormError code={failure} />}

      {!data ? (
        !failure && <RowsSkeleton rows={4} />
      ) : (
        <>
          <div>
            <p className="text-lg font-bold">
              {night(data.night, "long")}
              {data.info.title && <span className="font-normal">, {data.info.title}</span>}
            </p>
            <dl className="mt-2 flex gap-8">
              <div>
                <dt className="text-sm font-semibold text-desk-soft">{t.door.inside}</dt>
                <dd className="display tabular text-3xl">
                  {data.inside}
                  <span className="ml-1.5 text-sm font-semibold tracking-normal text-desk-soft">
                    {fill(t.door.ofCapacity, { n: data.info.capacity })}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-desk-soft">{t.door.turnedAway}</dt>
                <dd className="display tabular text-3xl">{data.denied}</dd>
              </div>
            </dl>
          </div>

          {data.entries.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-desk-line p-8 text-center text-desk-soft">{t.admin.logEmpty}</p>
          ) : (
            <>
            {/* Six columns do not fit a phone. There each decision is a short record: who and
                what was decided on top, then when, what the scanner said, and who decided. */}
            <ul className="divide-y divide-desk-line rounded-2xl border-2 border-desk-line bg-white md:hidden">
              {data.entries.map((entry) => (
                <li key={entry.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words text-[1.05rem] font-bold">{entry.personName}</p>
                    <span className={`chip flex-none ${entry.decision === "admitted" ? "text-stamp-green" : "text-stamp-red"}`}>
                      {entry.decision === "admitted" ? t.door.admitted : t.door.denied}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-desk-soft">
                    <span className="tabular font-semibold text-ink">{time(entry.createdAt)}</span>
                    {`, ${t.verdict[entry.verdict]}`}
                    {entry.method === "manual" && `, ${t.door.byHand}`}
                  </p>
                  <p className="text-sm text-desk-soft">
                    {entry.staffName}
                    {entry.reason && <span className="font-semibold text-stamp-red">{`, ${entry.reason}`}</span>}
                  </p>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto rounded-2xl border-2 border-desk-line bg-white md:block">
              <table className="w-full min-w-[40rem] text-left">
                <thead>
                  <tr className="border-b-2 border-ink text-sm">
                    <th scope="col" className="px-4 py-3 font-bold">{t.admin.colTime}</th>
                    <th scope="col" className="px-4 py-3 font-bold">{t.admin.colPerson}</th>
                    <th scope="col" className="px-4 py-3 font-bold">{t.admin.colDecision}</th>
                    <th scope="col" className="px-4 py-3 font-bold">{t.admin.colVerdict}</th>
                    <th scope="col" className="px-4 py-3 font-bold">{t.admin.colStaff}</th>
                    <th scope="col" className="px-4 py-3 font-bold">{t.admin.colReason}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-desk-line last:border-0">
                      <td className="tabular px-4 py-3 text-desk-soft">{time(entry.createdAt)}</td>
                      <th scope="row" className="px-4 py-3 font-bold">{entry.personName}</th>
                      <td className="px-4 py-3">
                        <span className={`chip ${entry.decision === "admitted" ? "text-stamp-green" : "text-stamp-red"}`}>
                          {entry.decision === "admitted" ? t.door.admitted : t.door.denied}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-desk-soft">
                        {t.verdict[entry.verdict]}
                        {entry.method === "manual" && `, ${t.door.byHand}`}
                      </td>
                      <td className="px-4 py-3 text-desk-soft">{entry.staffName}</td>
                      <td className="px-4 py-3 text-desk-soft">{entry.reason ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Arrow({ back = false }: { back?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={back ? "M15 5.5 8.5 12l6.5 6.5" : "m9 5.5 6.5 6.5L9 18.5"} />
    </svg>
  );
}
