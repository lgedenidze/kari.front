"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Face } from "@/components/face";
import { FormError } from "@/components/field";
import { RowsSkeleton } from "@/components/loading";
import { useMe } from "@/components/me";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import { peek, put } from "@/lib/live-store";
import { networkOf } from "@/lib/profile-link";
import type { AdminUser, AdminUserDetail, UserPage, UserRole, UserStatus } from "@/lib/types";

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

/** Minus and plus drawn to the same weight; the font's own minus is a hairline beside its plus. */
function Sign({ plus = false }: { plus?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d={plus ? "M3 8h10M8 3v10" : "M3 8h10"} />
    </svg>
  );
}

/** What an admin can change about a person. One of these goes with each tap. */
interface Change {
  role?: UserRole;
  status?: UserStatus;
  inviteMode?: "on" | "off";
  inviteQuota?: number;
  staffNotes?: string;
}

/**
 * One person. What the bar decides about them — what they are here, whether they may bring
 * guests, whether they get in — is a card of controls, and each is saved by the tap that
 * changes it. A switch that waits for a Save button further down the page looks done and is
 * not. The person's own phone hears of a change within half a minute (signed-chrome.tsx).
 */
function PersonDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { t, fill, night, date, dateTime } = useI18n();
  const { me, refresh } = useMe();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // What was just tapped, shown as if it were already so while the API answers.
  const [sending, setSending] = useState<Change | null>(null);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Suspending voids passes and invites and cannot be taken back, so it is asked for twice.
  const [suspending, setSuspending] = useState(false);
  // The notes as typed. Null until they are touched, and again once they are saved.
  const [notes, setNotes] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<AdminUserDetail>(`/admin/users/${id}`)
      .then(setDetail)
      .catch((error) => setFailure(isApiError(error) ? error.code : "server_error"));
    return () => clearTimeout(savedTimer.current);
  }, [id]);

  async function change(patch: Change) {
    setSending(patch);
    setSaved(false);
    setFailure(null);
    try {
      const next = await api.patch<AdminUserDetail>(`/admin/users/${id}`, patch);
      setDetail(next);
      if (patch.staffNotes !== undefined) setNotes(null);
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
      // An admin who changed their own account sees it in their own dock at once.
      if (next.user.id === me.id) void refresh();
    } catch (error) {
      setFailure(isApiError(error) ? (Object.values(error.fields)[0] ?? error.code) : "server_error");
    }
    setSending(null);
    setSuspending(false);
  }

  async function resetPassword() {
    setFailure(null);
    try {
      setTempPassword((await api.post<{ tempPassword: string }>(`/admin/users/${id}/reset-password`)).tempPassword);
    } catch (error) {
      setFailure(isApiError(error) ? error.code : "server_error");
    }
  }

  if (!detail) {
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
  const busy = sending !== null;
  const role = sending?.role ?? user.role;
  const status = suspending ? "banned" : (sending?.status ?? user.status);
  const invites = sending?.inviteMode ? sending.inviteMode === "on" : user.inviteMode !== "off";
  const perNight = sending?.inviteQuota ?? detail.effectiveQuota;
  const notesNow = notes ?? user.staffNotes ?? "";
  const notesChanged = notes !== null && notes.trim() !== (user.staffNotes ?? "");

  return (
    <div className="space-y-6">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <button type="button" className="btn btn-line btn-small" onClick={onBack}>
          {t.common.back}
        </button>
        {/* Every tap below saves. This is where it says so, in the same place each time. */}
        <p role="status" className="flex items-center gap-1.5 text-sm font-bold text-stamp-green">
          {saved && (
            <>
              <svg viewBox="0 0 12 12" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m2.5 6.4 2.3 2.3 4.7-5" />
              </svg>
              {t.common.saved}
            </>
          )}
        </p>
      </div>

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

      <section className="divide-y-2 divide-desk-line rounded-2xl border-2 border-desk-line bg-white" aria-busy={busy}>
        {/* What they are here. The dock on their phone follows it: the door, the office. */}
        <div className="p-4">
          <p className="label" id="role-label">
            {t.admin.roleLabel}
          </p>
          <div role="radiogroup" aria-labelledby="role-label" className="grid grid-cols-3 overflow-hidden rounded-xl border-2 border-ink">
            {ROLES.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={role === value}
                disabled={busy}
                onClick={() => role !== value && change({ role: value })}
                className={`min-h-12 border-ink px-1 text-[0.95rem] font-bold not-first:border-l-2 ${
                  role === value ? "bg-ink text-paper-light" : "bg-white active:bg-desk"
                }`}
              >
                {t.roleShort[value]}
              </button>
            ))}
          </div>
          <p className="hint">{t.roleOpens[role]}</p>
        </div>

        {/* Bringing guests is for members, so there is nothing to switch for anyone else. */}
        {user.status === "approved" && (
          <div>
            <button
              type="button"
              role="switch"
              aria-checked={invites}
              disabled={busy}
              onClick={() => change({ inviteMode: invites ? "off" : "on" })}
              className="flex min-h-14 w-full items-center justify-between gap-4 px-4 text-left font-bold active:bg-desk"
            >
              {t.admin.invitesLabel}
              <span
                className={`relative h-8 w-14 flex-none rounded-full border-2 border-ink transition-colors ${invites ? "bg-ink" : "bg-white"}`}
                aria-hidden="true"
              >
                <span
                  className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-[left] ${
                    invites ? "left-[1.7rem] bg-paper-light" : "left-1 bg-ink"
                  }`}
                />
              </span>
            </button>
            {invites && (
              <div className="flex items-center justify-between gap-4 px-4 pb-3.5">
                <span className="font-semibold text-desk-soft" id="per-night">
                  {t.admin.quota}
                </span>
                <span className="flex flex-none items-center gap-1" role="group" aria-labelledby="per-night">
                  <button
                    type="button"
                    className="btn btn-line btn-small !w-11 !px-0 text-xl"
                    disabled={busy || perNight <= 1}
                    aria-label={t.admin.fewer}
                    onClick={() => change({ inviteQuota: perNight - 1 })}
                  >
                    <Sign />
                  </button>
                  <output className="tabular w-9 text-center text-xl font-extrabold" aria-live="polite">
                    {perNight}
                  </output>
                  <button
                    type="button"
                    className="btn btn-line btn-small !w-11 !px-0 text-xl"
                    disabled={busy || perNight >= 50}
                    aria-label={t.admin.more}
                    onClick={() => change({ inviteQuota: perNight + 1 })}
                  >
                    <Sign plus />
                  </button>
                </span>
              </div>
            )}
          </div>
        )}

        <div className="p-4">
          <label className="flex items-center justify-between gap-4">
            <span className="font-bold">{t.admin.statusLabel}</span>
            <select
              value={status}
              disabled={busy}
              onChange={(event) => {
                const next = event.target.value as UserStatus;
                setSaved(false);
                setSuspending(next === "banned" && user.status !== "banned");
                if (next !== "banned" && next !== user.status) void change({ status: next });
              }}
              className="input !w-auto min-w-0 max-w-[62%]"
            >
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t.status[value]}
                </option>
              ))}
            </select>
          </label>
          {suspending && (
            // The question opens under the fold on a phone, so it is brought into view.
            <div className="rise mt-3" ref={(asked) => asked?.scrollIntoView({ block: "center", behavior: "smooth" })}>
              <p className="font-semibold">{t.admin.suspendConfirm}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn btn-danger flex-1" disabled={busy} onClick={() => change({ status: "banned" })}>
                  {t.admin.suspend}
                </button>
                <button type="button" className="btn btn-line flex-1" disabled={busy} onClick={() => setSuspending(false)}>
                  {t.common.back}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border-2 border-desk-line bg-white p-4">
        <label className="block">
          <span className="label">{t.admin.doorNotes}</span>
          <textarea rows={3} maxLength={1000} value={notesNow} onChange={(event) => setNotes(event.target.value)} className="input" />
          <span className="hint block">{t.admin.doorNotesHint}</span>
        </label>
        {/* The one thing here that is typed, so the one thing with a button to send it. */}
        {notesChanged && (
          <button type="button" className="btn btn-ink rise mt-3" disabled={busy} onClick={() => change({ staffNotes: notesNow })}>
            {t.common.save}
          </button>
        )}
      </section>

      <section className="rounded-2xl border-2 border-desk-line bg-white p-4">
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
