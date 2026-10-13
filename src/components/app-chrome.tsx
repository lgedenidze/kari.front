"use client";

import Link from "next/link";
// Not a public entry point: Next.js 16.4 exposes the "whole page" kind of prefetch only here.
// Recheck this import when upgrading Next (the build fails loudly if the path moves).
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useI18n } from "@/i18n/provider";
import { LANG_COOKIE, type Lang } from "@/venue";
import { VenueMark } from "./brand";
import { InviteIcon, OfficeIcon, PassIcon, ProfileIcon, ScanIcon } from "./icons";
import type { UserRole } from "@/lib/types";

const YEAR = 60 * 60 * 24 * 365;

export function saveLang(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=${YEAR}; samesite=lax`;
}

/** On a public landing page: remember its language, so the app opens in the same one. */
export function RememberLang({ lang }: { lang: Lang }) {
  useEffect(() => saveLang(lang), [lang]);
  return null;
}

/** The language toggle inside the app, where language is a saved choice rather than a URL. */
export function LangToggle({ className = "" }: { className?: string }) {
  const { lang } = useI18n();
  const router = useRouter();
  const other: Lang = lang === "ka" ? "en" : "ka";
  return (
    <button
      type="button"
      lang={other}
      className={`btn btn-line btn-small ${className}`}
      onClick={() => {
        saveLang(other);
        router.refresh();
      }}
    >
      {other === "en" ? "English" : "ქართული"}
    </button>
  );
}

/** The quiet top bar on every app screen: the venue's name, and the language. */
export function TopBar({ right }: { right?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 px-5 pt-[max(1.1rem,env(safe-area-inset-top))]">
      <Link href="/" aria-label="NISLI">
        <VenueMark className="text-[0.95rem]" />
      </Link>
      <div className="flex items-center gap-2">{right ?? <LangToggle />}</div>
    </header>
  );
}

/**
 * The one way round the whole app: a dock that floats over every signed-in screen.
 *
 * A member sees the pass, invites and their profile. Door staff also get the scanner, and an
 * admin the back office — the same dock, on those screens too, so going from the door to the
 * office and back is a single tap from anywhere.
 *
 * The place you are in is a paper ticket stub, notched like every ticket in the app, and it
 * slides to the tab you tap.
 *
 * `shown` is where the marker sits: the tab just tapped, or else the page that is open. The
 * frame above decides that (signed-chrome.tsx), because the screen itself answers a tap too.
 */
export function Dock({
  role,
  invitesWaiting = 0,
  shown,
  onTap,
}: {
  role: UserRole;
  invitesWaiting?: number;
  shown: string;
  onTap: (href: string) => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const tabs = [
    { href: "/pass", label: t.pass.title, icon: PassIcon, badge: 0 },
    { href: "/invites", label: t.invites.title, icon: InviteIcon, badge: invitesWaiting },
    ...(role !== "member" ? [{ href: "/door", label: t.door.title, icon: ScanIcon, badge: 0 }] : []),
    ...(role === "admin" ? [{ href: "/admin", label: t.admin.short, icon: OfficeIcon, badge: 0 }] : []),
    { href: "/profile", label: t.profile.title, icon: ProfileIcon, badge: 0 },
  ];
  const current = tabs.findIndex((tab) => shown.startsWith(tab.href));
  const count = tabs.length;

  // Every tab is fetched ahead, in full (`prefetch` on the links below), so a tap has the
  // screen in hand and shows it at once. What was fetched goes stale after five minutes, and
  // Next.js only fetches again on a navigation or a touch — so someone who stays on one screen
  // longer than that (the door, all night) would wait on their next tap. Asking again here
  // costs nothing while the copy is fresh, and replaces it soon after it is not.
  const hrefs = tabs.map((tab) => tab.href).join(" ");
  useEffect(() => {
    const keepWarm = () => {
      if (document.visibilityState !== "visible") return;
      for (const href of hrefs.split(" ")) router.prefetch(href, { kind: PrefetchKind.FULL });
    };
    const timer = setInterval(keepWarm, 20_000);
    document.addEventListener("visibilitychange", keepWarm);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", keepWarm);
    };
  }, [router, hrefs]);

  return (
    <nav
      aria-label={t.common.home}
      className="tab-dock pointer-events-none sticky bottom-0 z-10 mt-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-6"
    >
      <div
        className="pointer-events-auto relative mx-auto rounded-[1.75rem] border-2 border-ink-line bg-ink-deep p-1.5 shadow-[0_14px_34px_rgb(4_9_30/0.6)]"
        style={{ maxWidth: `${Math.max(22, count * 5.2)}rem` }}
      >
        {current >= 0 && (
          <span
            aria-hidden="true"
            className="tab-stub absolute inset-y-1.5 left-1.5"
            style={{ width: `calc((100% - 0.75rem) / ${count})`, transform: `translateX(${current * 100}%)` }}
          />
        )}
        <ul className="relative grid" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
          {tabs.map((tab, index) => {
            const active = index === current;
            return (
              <li key={tab.href}>
                {/* Fetched ahead, in full: a tap then has the screen in hand and shows it at once,
                    with no placeholder. Only tabs this role may open are ever drawn here. */}
                <Link
                  href={tab.href}
                  prefetch
                  onClick={() => onTap(tab.href)}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-[3.75rem] flex-col items-center justify-center rounded-[1.2rem] px-0.5 pt-0.5 text-[0.72rem] font-bold transition-colors duration-200 ${
                    active ? "text-ink-deep" : "text-ink-soft hover:text-paper-light"
                  }`}
                >
                  <span className="relative">
                    <tab.icon />
                    {tab.badge > 0 && (
                      <span className="absolute -right-2.5 -top-1.5 grid h-[1.15rem] min-w-[1.15rem] place-items-center rounded-full bg-stop px-1 text-[0.68rem] font-extrabold text-ink-deep ring-2 ring-ink-deep">
                        {tab.badge}
                      </span>
                    )}
                  </span>
                  {/* The condensed cut, like the headlines: five labels fit a 360px phone.
                      The line is tall on purpose: Georgian letters hang well below it (ვ, ფ, პ),
                      and a tight, clipped line cuts their tails off. */}
                  <span className="max-w-full truncate leading-[1.5]" style={{ fontVariationSettings: '"wdth" 78' }}>
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
