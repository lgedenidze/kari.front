"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Dock, LangToggle } from "@/components/app-chrome";
import { VenueMark, WoxCredit } from "@/components/brand";
import { useMe } from "@/components/me";
import { useI18n } from "@/i18n/provider";
import { LogTab } from "./log";
import { NightsTab } from "./nights";
import { OverviewTab } from "./overview";
import { PeopleTab } from "./people";
import { RequestsTab } from "./requests";
import { SettingsTab } from "./settings";

const TABS = ["tonight", "requests", "people", "nights", "log", "settings"] as const;
export type AdminTab = (typeof TABS)[number];

/**
 * The back office is a desk in daylight: a light ground, ink text, plain tables. It is used
 * sitting down, for minutes at a time — the opposite of the door.
 */
export function AdminScreen() {
  const { t } = useI18n();
  const { me } = useMe();
  const [tab, setTab] = useState<AdminTab>("tonight");

  // The tab lives in the address, so a refresh or a shared link lands in the same place.
  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash.slice(1) as AdminTab;
      if (TABS.includes(hash)) setTab(hash);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const go = (next: AdminTab) => {
    window.history.replaceState(null, "", `#${next}`);
    setTab(next);
  };

  const labels: Record<AdminTab, string> = {
    tonight: t.admin.navTonight,
    requests: t.admin.navRequests,
    people: t.admin.navPeople,
    nights: t.admin.navNights,
    log: t.admin.navLog,
    settings: t.admin.navSettings,
  };

  return (
    <div className="flex min-h-dvh flex-col bg-desk text-ink" style={{ ["--ground" as string]: "var(--color-desk)", ["--wox-dot" as string]: "#7b5fcb" }}>
      <header className="border-b-2 border-desk-line bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 pt-4 sm:px-6">
          <Link href="/pass">
            <VenueMark className="text-[0.95rem]" />
          </Link>
          <LangToggle />
        </div>
        <nav aria-label={t.admin.title} className="mx-auto w-full max-w-5xl overflow-x-auto px-2 sm:px-4">
          <ul className="flex min-w-max gap-1 pt-3">
            {TABS.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  aria-current={tab === key ? "page" : undefined}
                  onClick={() => go(key)}
                  className={`min-h-11 border-b-[3px] px-3 pb-2 text-[0.95rem] font-bold ${
                    tab === key ? "border-ink text-ink" : "border-transparent text-desk-soft hover:text-ink"
                  }`}
                >
                  {labels[key]}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:px-6">
        {tab === "tonight" && <OverviewTab go={go} />}
        {tab === "requests" && <RequestsTab />}
        {tab === "people" && <PeopleTab />}
        {tab === "nights" && <NightsTab />}
        {tab === "log" && <LogTab />}
        {tab === "settings" && <SettingsTab />}
      </main>

      <footer className="flex justify-center pb-2">
        <WoxCredit label={t.common.poweredBy} className="text-desk-soft" />
      </footer>

      <Dock role={me.role} invitesWaiting={me.pendingInvites} />
    </div>
  );
}
