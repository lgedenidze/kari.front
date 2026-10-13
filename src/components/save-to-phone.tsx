"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/provider";

// Two ways to keep a ticket, under every live one.
//
// "Download ticket" hands over the ticket as a picture (lib/ticket-image.tsx): on a phone it
// goes through the share sheet, where "Save Image" puts it in Photos and the same sheet sends
// it to a friend; on a computer it is a plain download. The picture carries the name, the
// night and the short code, and a QR that opens the live ticket.
//
// "Add to home screen" keeps the live ticket itself one tap away, where it opens like an app.
//
// Neither is "Add to Apple/Google Wallet", on purpose. A Wallet pass carries one fixed barcode,
// and this ticket's whole defence against screenshots is that its code changes every thirty
// seconds.

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

/** The picture, fetched once per address and kept: a second tap does not draw it again. */
function fetchPicture(image: string): Promise<Blob> {
  return fetch(image, { credentials: "same-origin" }).then((response) => {
    if (!response.ok) throw new Error(`ticket image: ${response.status}`);
    return response.blob();
  });
}

export function SaveToPhone({
  image,
  fileName,
}: {
  /** Where this ticket's picture is served, e.g. "/pass/ticket.png". */
  image: string;
  /** What the saved file is called, without the extension. */
  fileName: string;
}) {
  const { t } = useI18n();
  const canPrompt = useSyncExternalStore(subscribeToPrompt, () => installPrompt !== null, () => false);
  const standalone = useSyncExternalStore(subscribeToStandalone, isStandalone, () => false);
  const [help, setHelp] = useState<"ios" | "other" | null>(null);
  const [making, setMaking] = useState(false);
  const [failed, setFailed] = useState(false);
  const picture = useRef<{ image: string; blob: Promise<Blob> } | null>(null);

  function pictureFor(): Promise<Blob> {
    if (picture.current?.image !== image) picture.current = { image, blob: fetchPicture(image) };
    return picture.current.blob;
  }

  // Have the picture in hand before it is asked for. A phone only opens its share sheet while
  // it still counts the tap as the reason, and drawing the picture takes a second or so: done
  // ahead, the sheet opens on the tap itself. It waits a moment first, so it never competes
  // with the ticket's own requests, and it is skipped for someone saving data.
  function warm() {
    void pictureFor().catch(() => {
      picture.current = null;
    });
  }
  useEffect(() => {
    const saving = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (saving) return;
    const timer = setTimeout(() => {
      if (picture.current?.image !== image) picture.current = { image, blob: fetchPicture(image) };
      picture.current.blob.catch(() => {
        picture.current = null;
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [image]);

  async function download() {
    setMaking(true);
    setFailed(false);
    try {
      const blob = await pictureFor();
      const file = new File([blob], `${fileName}.png`, { type: "image/png" });
      // On a phone the share sheet is the download: "Save Image" puts it in Photos.
      const touch = window.matchMedia("(pointer: coarse)").matches;
      if (touch && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (error) {
          // Closed the sheet: that is an answer. Anything else, fall through to a plain download.
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      picture.current = null;
      setFailed(true);
    } finally {
      setMaking(false);
    }
  }

  // Esc closes the instructions.
  useEffect(() => {
    if (!help) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setHelp(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [help]);

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
      <div className="w-full max-w-[22rem] space-y-2.5 text-center">
        <button
          type="button"
          className="btn btn-paper w-full"
          onPointerDown={warm}
          onClick={download}
          disabled={making}
          aria-live="polite"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5" />
            <path d="M4.5 16.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" />
          </svg>
          {making ? t.ticket.downloading : t.ticket.download}
        </button>
        {failed && (
          <p role="alert" className="notice-error text-left">
            {t.ticket.downloadFailed}
          </p>
        )}

        {/* Already opened from the home screen: there is nothing left to add. */}
        {!standalone && (
          <button type="button" className="btn btn-line w-full text-paper-light" onClick={save}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="6" y="2.5" width="12" height="19" rx="3" />
              <path d="M12 9v6M9 12h6" />
            </svg>
            {t.ticket.saveToPhone}
          </button>
        )}
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
