"use client";

import { useState } from "react";
import { FormError } from "@/components/field";
import { usePoll } from "@/components/me";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import type { Overview } from "@/lib/types";
import type { AdminTab } from "./admin-screen";

export function OverviewTab({ go }: { go: (tab: AdminTab) => void }) {
  const { t, fill, night } = useI18n();
  const [data, setData] = useState<Overview | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  usePoll(async () => {
    try {
      setData(await api.get<Overview>("/admin/overview"));
      setFailure(null);
    } catch (error) {
      setFailure(isApiError(error) ? error.code : "server_error");
    }
  }, 10000);

  if (!data) return failure ? <FormError code={failure} /> : <p className="text-desk-soft">{t.common.loading}</p>;

  const { tonight } = data;
  const figures: [string, number, string?][] = [
    [t.admin.insideNow, data.insideTonight, fill(t.door.ofCapacity, { n: tonight.capacity })],
    [t.admin.passesTonight, data.passesTonight],
    [t.admin.turnedAwayTonight, data.deniedTonight],
    [t.admin.members, data.members],
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="title">{tonight.title ?? night(tonight.night, "long")}</h1>
        <p className="mt-2 text-lg text-desk-soft">
          {tonight.open
            ? fill(t.landing.tonightOpen, { open: tonight.doorsOpen, close: tonight.doorsClose })
            : t.landing.tonightClosed}
        </p>
      </div>

      {data.pending > 0 && (
        <button
          type="button"
          onClick={() => go("requests")}
          className="paper flex w-full flex-col gap-4 p-5 text-left hover:bg-paper-light sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            <span className="display tabular block text-5xl">{data.pending}</span>
            <span className="font-bold">{t.admin.requestsWaiting}</span>
          </span>
          <span className="btn btn-ink">{t.admin.reviewRequests}</span>
        </button>
      )}

      <dl className="grid grid-cols-2 gap-x-5 gap-y-6 border-y-2 border-desk-line py-6 md:grid-cols-4">
        {figures.map(([label, value, note]) => (
          <div key={label}>
            <dt className="text-sm font-semibold leading-snug text-desk-soft">{label}</dt>
            <dd className="display tabular mt-1 text-5xl">
              {value}
              {note && <span className="ml-2 text-sm font-semibold tracking-normal text-desk-soft">{note}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <section>
        <h2 className="text-2xl">{t.admin.chartTitle}</h2>
        {data.series.every((point) => point.admitted === 0 && point.denied === 0) ? (
          // Fourteen rows of zeros say nothing. One sentence says it.
          <p className="mt-3 rounded-2xl border-2 border-dashed border-desk-line p-6 text-center text-desk-soft">
            {t.admin.chartEmpty}
          </p>
        ) : (
          <table className="mt-4 w-full text-left">
            <thead>
              <tr className="border-b-2 border-ink text-sm">
                <th scope="col" className="py-2 pr-3 font-bold">
                  {t.invites.night}
                </th>
                <th scope="col" className="w-[5.5rem] py-2 pr-3 text-right font-bold">
                  {t.door.admitted}
                </th>
                <th scope="col" className="w-[4.5rem] py-2 text-right font-bold">
                  {t.admin.colDenied}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...data.series].reverse().map((point) => {
                const quiet = point.admitted === 0 && point.denied === 0;
                return (
                  // A night with nobody is set back, so the busy ones are what the eye finds.
                  <tr key={point.night} className={`border-b border-desk-line ${quiet ? "text-desk-soft" : ""}`}>
                    {/* The short date on a phone, where the long one wraps onto two lines. */}
                    <th scope="row" className={`whitespace-nowrap py-2.5 pr-3 ${quiet ? "font-normal" : "font-bold"}`}>
                      <span className="sm:hidden">{night(point.night)}</span>
                      <span className="hidden sm:inline">{night(point.night, "long")}</span>
                    </th>
                    <td className={`tabular py-2.5 pr-3 text-right ${quiet ? "" : "font-extrabold"}`}>{point.admitted}</td>
                    <td className="tabular py-2.5 text-right">{point.denied}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
