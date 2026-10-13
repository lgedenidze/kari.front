"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Face } from "@/components/face";
import { FormError } from "@/components/field";
import { RowsSkeleton } from "@/components/loading";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import { peek, put } from "@/lib/live-store";
import { networkOf } from "@/lib/profile-link";
import type { AdminUser, AdminUserDetail, InviteMode, Settings, UserPage, UserRole, UserStatus } from "@/lib/types";

const STATUSES: UserStatus[] = ["approved", "pending", "guest", "rejected", "banned"];
const ROLES: UserRole[] = ["member", "staff", "admin"];

// The list as it opens — everyone, first page. Remembered, so the tab opens on it at once.
const EVERYONE = "/admin/users?page=1";

export function PeopleTab() {
  const { t, fill } = useI18n();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<UserStatus | "">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UserPage | null>(() => peek<UserPage>(EVERYONE) ?? null);
  const [failure, setFailure] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    try {
      const path = `/admin/users?${params}`;
      const found = await api.get<UserPage>(path);
      if (path === EVERYONE) put(EVERYONE, found);
      setData(found);
      setFailure(null);
    } catch (error) {
      setFailure(isApiError(error) ? error.code : "server_error");
    }
  }, [query, status, page]);

  // Typing waits a beat before it searches.
  useEffect(() => {
    const timer = setTimeout(load, 220);
    return () => clearTimeout(timer);
  }, [load]);

  if (openId) {
    return (
      <PersonDetail
        id={openId}
        onBack={() => {
          setOpenId(null);
          void load();
        }}
      />
    );
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <h1 className="title">{t.admin.navPeople}</h1>

      <label className="block max-w-md">
        <span className="sr-only">{t.admin.searchPeople}</span>
        <input
          type="search"
          className="input"
          placeholder={t.admin.searchPeople}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
      </label>

      {/* One line, which scrolls and fades at its far edge, like the tabs above: six filters
          wrapped into three rows before a single person was on screen. */}
      <div className="scroll-row -mx-4 flex gap-2 px-4" role="group" aria-label={t.admin.statusLabel}>
        {(["", ...STATUSES] as const).map((value) => (
          <button
            key={value || "all"}
            type="button"
            aria-pressed={status === value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
            className={`min-h-10 flex-none whitespace-nowrap rounded-full border-2 border-ink px-3.5 text-sm font-bold ${
              status === value ? "bg-ink text-paper-light" : "bg-white"
            }`}
          >
            {value ? t.status[value] : t.admin.all}
          </button>
        ))}
        <span className="w-6 flex-none" aria-hidden="true" />
      </div>

      {failure && <FormError code={failure} />}

      {!data ? (
        !failure && <RowsSkeleton rows={5} />
      ) : data.items.length === 0 ? (
        <p className="py-8 text-center text-desk-soft">{t.admin.nobody}</p>
      ) : (
        <>
        {/* On a phone a five-column table is cut off at the edge. There each person is a row
            to tap: who they are, where they stand, how often they have been. */}
        <ul className="divide-y divide-desk-line rounded-2xl border-2 border-desk-line bg-white md:hidden">
          {data.items.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => setOpenId(person.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left active:bg-desk"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[1.05rem] font-bold">
                    {person.firstName} {person.lastName}
                  </span>
                  <span className="tabular block truncate text-sm text-desk-soft">
                    {person.phone}
                    {person.role !== "member" && `, ${t.role[person.role]}`}
                  </span>
                </span>
                <span className="flex flex-none flex-col items-end gap-1">
                  <span className={`chip ${statusTone(person.status)}`}>{t.status[person.status]}</span>
                  <span className="tabular text-xs font-semibold text-desk-soft">{fill(t.door.nights, { n: person.visits })}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="hidden overflow-x-auto rounded-2xl border-2 border-desk-line bg-white md:block">
          <table className="w-full min-w-[34rem] text-left">
            <thead>
              <tr className="border-b-2 border-ink text-sm">
                <th scope="col" className="px-4 py-3 font-bold">{t.admin.colName}</th>
                <th scope="col" className="px-4 py-3 font-bold">{t.admin.colPhone}</th>
                <th scope="col" className="px-4 py-3 font-bold">{t.admin.colStatus}</th>
                <th scope="col" className="px-4 py-3 font-bold">{t.admin.colRole}</th>
                <th scope="col" className="px-4 py-3 text-right font-bold">{t.admin.colNights}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((person) => (
                <PersonRow key={person.id} person={person} onOpen={() => setOpenId(person.id)} />
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {data && pages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <button type="button" className="btn btn-line btn-small" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t.admin.previous}
          </button>
          <p className="tabular text-sm text-desk-soft">{fill(t.admin.pageOf, { page, pages })}</p>
          <button type="button" className="btn btn-line btn-small" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            {t.admin.next}
          </button>
        </div>
      )}
    </div>
  );
}

function statusTone(status: UserStatus): string {
  return status === "banned" ? "text-stamp-red" : status === "approved" ? "text-stamp-green" : "";
}

function PersonRow({ person, onOpen }: { person: AdminUser; onOpen: () => void }) {
  const { t } = useI18n();
  return (
    <tr className="border-b border-desk-line last:border-0 hover:bg-desk">
      <th scope="row" className="px-4 py-3 font-bold">
        <button type="button" className="link text-left" onClick={onOpen}>
          {person.firstName} {person.lastName}
        </button>
      </th>
      <td className="tabular px-4 py-3 text-desk-soft">{person.phone}</td>
      <td className="px-4 py-3">
        <span className={`chip ${statusTone(person.status)}`}>{t.status[person.status]}</span>
      </td>
      <td className="px-4 py-3 text-desk-soft">{t.role[person.role]}</td>
      <td className="tabular px-4 py-3 text-right font-bold">{person.visits}</td>
    </tr>
  );
}

function PersonDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { t, fill, night, date, dateTime } = useI18n();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.get<AdminUserDetail>(`/admin/users/${id}`), api.get<Settings>("/admin/settings")])
      .then(([person, venueSettings]) => {
        setDetail(person);
        setSettings(venueSettings);
      })
      .catch((error) => setFailure(isApiError(error) ? error.code : "server_error"));
  }, [id]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quota = String(form.get("inviteQuota") ?? "").trim();
    setBusy(true);
    setSaved(false);
    setFailure(null);
    try {
      setDetail(
        await api.patch<AdminUserDetail>(`/admin/users/${id}`, {
          status: form.get("status"),
          role: form.get("role"),
          inviteMode: form.get("inviteMode"),
          inviteQuota: quota === "" ? null : Number(quota),
          clearInviteQuota: quota === "",
          staffNotes: form.get("staffNotes"),
        }),
      );
      setSaved(true);
    } catch (error) {
      setFailure(isApiError(error) ? (Object.values(error.fields)[0] ?? error.code) : "server_error");
    }
    setBusy(false);
  }

  async function resetPassword() {
    setFailure(null);
    try {
      setTempPassword((await api.post<{ tempPassword: string }>(`/admin/users/${id}/reset-password`)).tempPassword);
    } catch (error) {
      setFailure(isApiError(error) ? error.code : "server_error");
    }
  }

  if (!detail || !settings) {
    return (
      <div className="space-y-4">
        <button type="button" className="btn btn-line btn-small" onClick={onBack}>
          {t.common.back}
        </button>
        {failure ? <FormError code={failure} /> : <RowsSkeleton rows={4} title />}
      </div>
    );
  }

  const { user } = detail;
  const modes: [InviteMode, string][] = [
    ["auto", fill(t.admin.inviteAuto, { n: settings.regularAfterVisits })],
    ["on", t.admin.inviteOn],
    ["off", t.admin.inviteOff],
  ];

  return (
    <div className="space-y-6">
      <button type="button" className="btn btn-line btn-small" onClick={onBack}>
        {t.common.back}
      </button>

      <div className="flex items-start gap-5">
        {user.hasPhoto && <Face userId={user.id} className="h-24 w-24 flex-none rounded-2xl border-2 border-ink object-cover" />}
        <div className="min-w-0">
          <h1 className="title">
            {user.firstName} {user.lastName}
          </h1>
          <p className="tabular mt-1 text-lg text-desk-soft">{user.phone}</p>
          <p className="mt-1 text-sm text-desk-soft">
            {fill(t.admin.joined, { date: date(user.createdAt) })}
            {detail.lastVisit && `. ${fill(t.admin.lastVisit, { date: night(detail.lastVisit) })}`}
            {`. ${fill(t.door.nights, { n: user.visits })}`}
            {detail.invitesSent > 0 && `. ${fill(t.admin.invitesSent, { n: detail.invitesSent })}`}
          </p>
          {user.profileUrl && (
            <a href={user.profileUrl} target="_blank" rel="noopener" className="link mt-2 inline-block">
              {fill(t.common.openProfile, { platform: networkOf(user.profileUrl) })}
            </a>
          )}
        </div>
      </div>

      {failure && <FormError code={failure} />}

      <form onSubmit={save} className="space-y-5 rounded-2xl border-2 border-desk-line bg-white p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="label">{t.admin.statusLabel}</span>
            <select name="status" defaultValue={user.status} className="input">
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t.status[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">{t.admin.roleLabel}</span>
            <select name="role" defaultValue={user.role} className="input">
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {t.role[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">{t.admin.invitesLabel}</span>
            <select name="inviteMode" defaultValue={user.inviteMode} className="input">
              {modes.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="hint block">{detail.canInvite ? t.admin.canInviteNow : t.admin.cannotInviteNow}</span>
          </label>
          <label className="block">
            <span className="label">{t.admin.quota}</span>
            <input
              name="inviteQuota"
              type="number"
              min={0}
              max={50}
              inputMode="numeric"
              defaultValue={user.inviteQuota ?? ""}
              placeholder={fill(t.admin.quotaDefault, { n: settings.defaultInviteQuota })}
              className="input"
            />
          </label>
        </div>
        <label className="block">
          <span className="label">{t.admin.doorNotes}</span>
          <textarea name="staffNotes" rows={3} maxLength={1000} defaultValue={user.staffNotes ?? ""} className="input" />
          <span className="hint block">{t.admin.doorNotesHint}</span>
        </label>
        <button type="submit" className="btn btn-ink" disabled={busy} aria-live="polite">
          {saved ? t.common.saved : t.common.save}
        </button>
      </form>

      <section className="rounded-2xl border-2 border-desk-line bg-white p-5">
        {tempPassword ? (
          <div role="status">
            <p className="font-bold">{t.admin.tempPassword}</p>
            <p className="code mt-2 select-all text-3xl">{tempPassword}</p>
          </div>
        ) : (
          <button type="button" className="btn btn-line" onClick={resetPassword}>
            {t.admin.resetPassword}
          </button>
        )}
      </section>

      <section>
        <h2 className="text-2xl">{t.admin.history}</h2>
        {detail.entries.length === 0 ? (
          <p className="mt-3 text-desk-soft">{t.admin.historyEmpty}</p>
        ) : (
          <ul className="mt-3 divide-y divide-desk-line rounded-2xl border-2 border-desk-line bg-white">
            {detail.entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="tabular block font-semibold">{dateTime(entry.createdAt)}</span>
                  <span className="block truncate text-sm text-desk-soft">
                    {entry.staffName}
                    {entry.reason && `, ${entry.reason}`}
                  </span>
                </span>
                <span className={`chip flex-none ${entry.decision === "admitted" ? "text-stamp-green" : "text-stamp-red"}`}>
                  {entry.decision === "admitted" ? t.door.admitted : t.door.denied}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
