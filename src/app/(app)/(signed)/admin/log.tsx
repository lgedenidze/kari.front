"use client";

import { useEffect, useState } from "react";
import { FormError } from "@/components/field";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import type { EntriesResponse } from "@/lib/types";

/** Every decision made at the door on one night: who, when, what the scanner said, who decided. */
export function LogTab() {
  const { t, fill, night, time } = useI18n();
  const [picked, setPicked] = useState("");
  const [data, setData] = useState<EntriesResponse | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    api
      .get<EntriesResponse>(picked ? `/admin/entries?night=${picked}` : "/admin/entries")
      .then((response) => {
        if (stale) return;
        setData(response);
        setFailure(null);
      })
      .catch((error) => !stale && setFailure(isApiError(error) ? error.code : "server_error"));
    return () => {
      stale = true;
    };
  }, [picked]);

  return (
    <div className="space-y-5">
      <h1 className="title">{t.admin.navLog}</h1>

      <label className="block max-w-[14rem]">
        <span className="label">{t.invites.night}</span>
        {/* The API answers with tonight first; the picker then starts from that date. */}
        <input type="date" className="input" value={picked || data?.night || ""} onChange={(event) => setPicked(event.target.value)} />
      </label>

      {failure && <FormError code={failure} />}

      {!data ? (
        <p className="text-desk-soft">{t.common.loading}</p>
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
