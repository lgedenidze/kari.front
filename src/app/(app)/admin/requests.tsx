"use client";

import { useCallback, useState } from "react";
import { FormError } from "@/components/field";
import { usePoll } from "@/components/me";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import type { AdminUser, UserPage } from "@/lib/types";

/** The review queue, oldest first: open the Facebook profile, then say yes or no. */
export function RequestsTab() {
  const { t } = useI18n();
  const [people, setPeople] = useState<AdminUser[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPeople((await api.get<UserPage>("/admin/users?status=pending")).items);
      setFailure(null);
    } catch (error) {
      setFailure(isApiError(error) ? error.code : "server_error");
    }
  }, []);

  usePoll(load, 15000);

  async function review(id: string, decision: "approve" | "reject", note: string) {
    setFailure(null);
    try {
      await api.post(`/admin/users/${id}/review`, { decision, note });
      setPeople((current) => current?.filter((person) => person.id !== id) ?? null);
    } catch (error) {
      setFailure(isApiError(error) ? error.code : "server_error");
      void load();
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-5xl">{t.admin.navRequests}</h1>
      {failure && <FormError code={failure} />}
      {!people ? (
        <p className="text-desk-soft">{t.common.loading}</p>
      ) : people.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-desk-line p-8 text-center text-lg text-desk-soft">
          {t.admin.requestsEmpty}
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {people.map((person) => (
            <RequestCard key={person.id} person={person} onReview={review} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestCard({
  person,
  onReview,
}: {
  person: AdminUser;
  onReview: (id: string, decision: "approve" | "reject", note: string) => Promise<void>;
}) {
  const { t, fill, dateTime } = useI18n();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const act = (decision: "approve" | "reject") => {
    setBusy(true);
    void onReview(person.id, decision, note).finally(() => setBusy(false));
  };

  return (
    <li className="paper flex flex-col gap-4 p-5">
      <div className="flex items-start gap-4">
        {person.hasPhoto && (
          // eslint-disable-next-line @next/next/no-img-element -- an authenticated API image
          <img src={`/api/photos/${person.id}`} alt="" className="h-20 w-20 flex-none rounded-2xl border-2 border-ink object-cover" />
        )}
        <div className="min-w-0">
          <h2 className="break-words text-3xl">
            {person.firstName} {person.lastName}
          </h2>
          <p className="tabular text-paper-soft">{person.phone}</p>
          {person.appliedAt && <p className="text-sm text-paper-soft">{fill(t.admin.asked, { when: dateTime(person.appliedAt) })}</p>}
        </div>
      </div>

      {person.facebookUrl && (
        <a href={person.facebookUrl} target="_blank" rel="noopener" className="btn btn-line">
          {t.admin.openFacebook}
        </a>
      )}

      <label className="block">
        <span className="label">
          {t.admin.noteForGuest} <span className="font-normal text-paper-soft">({t.common.optional})</span>
        </span>
        <input className="input" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
      </label>

      <div className="mt-auto grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-line" disabled={busy} onClick={() => act("reject")}>
          {t.admin.reject}
        </button>
        <button type="button" className="btn btn-ink" disabled={busy} onClick={() => act("approve")}>
          {t.admin.approve}
        </button>
      </div>
    </li>
  );
}
