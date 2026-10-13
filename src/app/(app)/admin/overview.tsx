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
        <h1 className="text-5xl">{tonight.title ?? night(tonight.night, "long")}</h1>
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
          className="paper flex w-full items-center justify-between gap-4 p-5 text-left hover:bg-paper-light"
        >
          <span>
            <span className="display tabular block text-5xl">{data.pending}</span>
            <span className="font-bold">{t.admin.requestsWaiting}</span>
          </span>
          <span className="btn btn-ink">{t.admin.reviewRequests}</span>
        </button>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-y-2 border-desk-line py-6 md:grid-cols-4">
        {figures.map(([label, value, note]) => (
          <div key={label}>
            <dt className="text-sm font-semibold text-desk-soft">{label}</dt>
            <dd className="display tabular mt-1 text-5xl">
              {value}
              {note && <span className="ml-2 text-sm font-semibold tracking-normal text-desk-soft">{note}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <section>
        <h2 className="text-2xl">{t.admin.chartTitle}</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[20rem] text-left">
            <thead>
              <tr className="border-b-2 border-ink text-sm">
                <th scope="col" className="py-2 pr-4 font-bold">
                  {t.invites.night}
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-bold">
                  {t.door.admitted}
                </th>
                <th scope="col" className="py-2 text-right font-bold">
                  {t.door.turnedAway}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...data.series].reverse().map((point) => (
                <tr key={point.night} className="border-b border-desk-line">
                  <th scope="row" className="py-2 pr-4 font-semibold">
                    {night(point.night, "long")}
                  </th>
                  <td className="tabular py-2 pr-4 text-right font-bold">{point.admitted}</td>
                  <td className="tabular py-2 text-right text-desk-soft">{point.denied}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
