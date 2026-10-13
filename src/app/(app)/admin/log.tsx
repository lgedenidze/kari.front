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
      <h1 className="text-5xl">{t.admin.navLog}</h1>

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
          <p className="text-lg">
            <span className="font-bold">{night(data.night, "long")}</span>
            <span className="text-desk-soft">
              {`. ${t.door.inside}: `}
              <span className="tabular font-bold text-ink">{data.inside}</span> {fill(t.door.ofCapacity, { n: data.info.capacity })}
              {`. ${t.door.turnedAway}: `}
              <span className="tabular font-bold text-ink">{data.denied}</span>
            </span>
          </p>

          {data.entries.length === 0 ? (
            <p className="py-8 text-center text-desk-soft">{t.admin.logEmpty}</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border-2 border-desk-line bg-white">
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
          )}
        </>
      )}
    </div>
  );
}
