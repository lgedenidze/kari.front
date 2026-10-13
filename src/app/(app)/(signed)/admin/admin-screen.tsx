"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { LangToggle } from "@/components/app-chrome";
import { VenueMark, WoxCredit } from "@/components/brand";
import { Count } from "@/components/count";
import { useRequestsWaiting } from "@/components/me";
import { useI18n } from "@/i18n/provider";
import type { Overview } from "@/lib/types";
import { LogTab } from "./log";
import { NightsTab } from "./nights";
import { OverviewSkeleton, OverviewTab } from "./overview";
import { PeopleTab } from "./people";
import { RequestsTab } from "./requests";
import { SettingsTab } from "./settings";

const TABS = ["tonight", "requests", "people", "nights", "log", "settings"] as const;
export type AdminTab = (typeof TABS)[number];

/**
 * The back office is a desk in daylight: a light ground, ink text, plain tables. It is used
 * sitting down, for minutes at a time — the opposite of the door.
 *
 * This is its frame — the bar at the top and the row of tabs. Nothing in it waits for the
 * server, so it is drawn from the tap, the same whether the page has arrived or not. The count
 * on the requests tab is the one the dock shows: it came with the account, not with this page.
 */
function AdminFrame({ tab, onTab, children }: { tab: AdminTab; onTab?: (tab: AdminTab) => void; children: ReactNode }) {
  const { t } = useI18n();
  const waiting = useRequestsWaiting();

  const labels: Record<AdminTab, string> = {
    tonight: t.admin.navTonight,
    requests: t.admin.navRequests,
    people: t.admin.navPeople,
    nights: t.admin.navNights,
    log: t.admin.navLog,
    settings: t.admin.navSettings,
  };

  return (
    // ground-desk tells the body to take the desk colour too, so the browser's own toolbars
    // and the pull-past-the-end area match this light screen instead of the app's dark ink.
    <div
      className="ground-desk flex flex-1 flex-col bg-desk text-ink"
      style={{ ["--wox-dot" as string]: "#7b5fcb" }}
    >
      <header className="sticky top-0 z-10 border-b-2 border-desk-line bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 pt-[max(0.9rem,env(safe-area-inset-top))] sm:px-6">
          <Link href="/pass">
            <VenueMark className="text-[0.95rem]" />
          </Link>
          <LangToggle short />
        </div>
        {/* Six tabs do not fit a phone. The row scrolls, fades at its far edge to say so, and
            brings the chosen tab into view. */}
        <nav aria-label={t.admin.title} className="scroll-row mx-auto w-full max-w-5xl px-2 sm:px-4">
          <ul className="flex min-w-max gap-1 pr-8 pt-2">
            {TABS.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  aria-current={tab === key ? "page" : undefined}
                  onClick={(event) => {
                    onTab?.(key);
                    event.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
                  }}
                  className={`inline-flex min-h-11 items-center gap-1.5 border-b-[3px] px-3 pb-2 text-[0.95rem] font-bold ${
                    tab === key ? "border-ink text-ink" : "border-transparent text-desk-soft hover:text-ink"
                  }`}
                >
                  {labels[key]}
                  {key === "requests" && <Count n={waiting} ground="desk" />}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-8 pt-6 sm:px-6 sm:pt-7">{children}</main>

      <footer className="flex justify-center pb-2">
        <WoxCredit label={t.common.poweredBy} className="text-desk-soft" />
      </footer>
    </div>
  );
}

/** The back office while its page is on the way: the desk and its tabs, tonight still coming. */
export function AdminSkeleton() {
  return (
    <AdminFrame tab="tonight">
      <OverviewSkeleton />
    </AdminFrame>
  );
}

export function AdminScreen({ first }: { first: Overview | null }) {
  const [tab, setTab] = useState<AdminTab>("tonight");
  // The night the door's list opens on, when it is opened from a night on the first tab.
  const [listNight, setListNight] = useState("");

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

  const go = (next: AdminTab, night = "") => {
    window.history.replaceState(null, "", `#${next}`);
    setListNight(night);
    setTab(next);
    // A tab starts at its top, wherever the last one was left.
    window.scrollTo(0, 0);
  };

  return (
    <AdminFrame tab={tab} onTab={go}>
      {tab === "tonight" && <OverviewTab go={go} first={first} />}
      {tab === "requests" && <RequestsTab />}
      {tab === "people" && <PeopleTab />}
      {tab === "nights" && <NightsTab />}
      {tab === "log" && <LogTab night={listNight} />}
      {tab === "settings" && <SettingsTab />}
    </AdminFrame>
  );
}
