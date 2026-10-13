"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/provider";

// "Save to phone" puts the live ticket on the home screen, where it opens like an app.
//
// It is deliberately not "Add to Apple/Google Wallet". A Wallet pass carries one fixed barcode,
// and this ticket's whole defence against screenshots is that its code changes every thirty
// seconds. Saved to the home screen, the ticket stays the real, live one.

/** Chrome's install prompt. It fires once, early, so it is caught for the whole page. */
type InstallPrompt = Event & { prompt: () => Promise<void> };

let installPrompt: InstallPrompt | null = null;
const promptListeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // we offer it on our own button, when the guest has a ticket
    installPrompt = event as InstallPrompt;
    promptListeners.forEach((listener) => listener());
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    promptListeners.forEach((listener) => listener());
  });
}

const subscribeToPrompt = (listener: () => void) => {
  promptListeners.add(listener);
  return () => promptListeners.delete(listener);
};

const STANDALONE = "(display-mode: standalone)";
const subscribeToStandalone = (listener: () => void) => {
  const query = window.matchMedia(STANDALONE);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};
/** True when this is already running from the home screen — nothing left to save. */
const isStandalone = () =>
  window.matchMedia(STANDALONE).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function isIos(): boolean {
  // iPadOS reports itself as a Mac; a Mac with a touch screen is an iPad.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function SaveToPhone() {
  const { t } = useI18n();
  const canPrompt = useSyncExternalStore(subscribeToPrompt, () => installPrompt !== null, () => false);
  const standalone = useSyncExternalStore(subscribeToStandalone, isStandalone, () => false);
  const [help, setHelp] = useState<"ios" | "other" | null>(null);

  // Esc closes the instructions.
  useEffect(() => {
    if (!help) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setHelp(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [help]);

  if (standalone) return null;

  async function save() {
    if (canPrompt && installPrompt) {
      // Android and desktop Chrome: the browser's own dialog does the rest.
      await installPrompt.prompt().catch(() => {});
      return;
    }
    // Safari has no prompt to call; the guest has to do it by hand, so show exactly how.
    setHelp(isIos() ? "ios" : "other");
  }

  return (
    <>
      <div className="w-full max-w-[22rem] text-center">
        <button type="button" className="btn btn-line w-full text-paper-light" onClick={save}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="6" y="2.5" width="12" height="19" rx="3" />
            <path d="M12 8v6M9.5 11.5 12 14l2.5-2.5" />
          </svg>
          {t.ticket.saveToPhone}
        </button>
        <p className="mt-2 text-sm text-ink-soft">{t.ticket.saveHint}</p>
      </div>

      {help && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-ink-deep/80 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={t.ticket.saveTitle}
          onClick={() => setHelp(null)}
        >
          <div className="paper rise w-full max-w-sm p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-3xl">{t.ticket.saveTitle}</h2>
            <ol className="mt-5 space-y-4">
              {(help === "ios" ? [t.ticket.saveIos1, t.ticket.saveIos2, t.ticket.saveIos3] : [t.ticket.saveOther1, t.ticket.saveOther2]).map(
                (step, index) => (
                  <li key={step} className="flex gap-3.5">
                    <span aria-hidden="true" className="display grid h-8 w-8 flex-none place-items-center rounded-full bg-ink text-lg text-paper-light">
                      {index + 1}
                    </span>
                    <span className="pt-0.5">
                      {step}
                      {/* the glyph to look for, since "Share" means nothing until you have seen it */}
                      {help === "ios" && index === 0 && (
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ml-1.5 inline-block align-[-0.3em]">
                          <path d="M12 15V3.5M8 7l4-3.5L16 7" />
                          <path d="M7.5 10.5H6a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1.5" />
                        </svg>
                      )}
                    </span>
                  </li>
                ),
              )}
            </ol>
            <button type="button" className="btn btn-ink btn-big mt-6 w-full" onClick={() => setHelp(null)}>
              {t.ticket.saveDone}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
