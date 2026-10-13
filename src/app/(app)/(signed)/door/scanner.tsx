"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/provider";
import { codeIdentity, createPresence } from "@/lib/scan-presence";

// Chrome on Android reads QR codes natively. Everywhere else (iOS Safari, Firefox) frames are
// decoded in JavaScript by jsQR, loaded only when it is needed.
interface NativeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => NativeDetector;
  }
}

type CameraState = "starting" | "running" | "blocked" | "missing";

const SCAN_EVERY_MS = 130;

export function Scanner({
  active,
  checking,
  onToken,
}: {
  /** False while a result is on screen: the camera stays on but nothing is read. */
  active: boolean;
  /** A read is being checked with the server. */
  checking: boolean;
  onToken: (token: string) => void;
}) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const presence = useRef(createPresence());
  const report = useRef(onToken);
  const [state, setState] = useState<CameraState>("starting");
  // Bumped to start the camera again: by the retry button, or when the phone took it away.
  const [attempt, setAttempt] = useState(0);
  const [torch, setTorch] = useState<"unsupported" | "off" | "on">("unsupported");

  useEffect(() => {
    report.current = onToken;
  });

  useEffect(() => {
    let cancelled = false;
    // A browser with no camera API is treated like a device with no camera.
    const request =
      navigator.mediaDevices?.getUserMedia?.({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          // Keep refocusing: a phone held at arm's length is never quite still.
          advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
        },
      }) ?? Promise.reject(new DOMException("no camera API", "NotFoundError"));

    request
      .then(async (media) => {
        if (cancelled) {
          // The screen was left before the camera answered: hand it straight back.
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = media;
        if (video.current) {
          video.current.srcObject = media;
          await video.current.play().catch(() => {});
        }
        const track = media.getVideoTracks()[0];
        const capabilities = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
        setTorch(capabilities.torch ? "off" : "unsupported");
        setState("running");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        setState(name === "NotFoundError" || name === "OverconstrainedError" ? "missing" : "blocked");
      });

    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
  }, [attempt]);

  // Phones take the camera away when the browser goes to the background. Coming back, start it
  // again rather than leave staff looking at a frozen frame.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const track = stream.current?.getVideoTracks()[0];
      if (!track || track.readyState === "ended" || track.muted) setAttempt((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // A door shift is hours long; the screen must not dim between guests.
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = () => {
      navigator.wakeLock
        .request("screen")
        .then((sentinel) => (lock = sentinel))
        .catch(() => {});
    };
    acquire();
    const onVisible = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (state !== "running" || !active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const canvas = document.createElement("canvas");
    const native = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
    let jsqr: typeof import("jsqr").default | null = null;

    // Coming back from a result: the pass that was just decided is very likely still in front
    // of the camera. It stays held until it has been away.
    presence.current.resume(Date.now());

    const read = async (): Promise<string | null> => {
      const element = video.current;
      if (!element || element.readyState < 2 || element.videoWidth === 0) return null;

      if (native) {
        const found = await native.detect(element).catch(() => []);
        return found[0]?.rawValue ?? null;
      }

      jsqr ??= (await import("jsqr")).default;
      // Only the middle square is decoded — the part inside the corner marks. It is a third of
      // the pixels, so three times as fast on a phone, and a second pass at the edge of the
      // picture is not read by accident.
      const side = Math.min(element.videoWidth, element.videoHeight);
      const size = Math.min(side, 520);
      canvas.width = canvas.height = size;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;
      context.drawImage(element, (element.videoWidth - side) / 2, (element.videoHeight - side) / 2, side, side, 0, 0, size, size);
      const frame = context.getImageData(0, 0, size, size);
      return jsqr(frame.data, size, size, { inversionAttempts: "dontInvert" })?.data || null;
    };

    const loop = async () => {
      if (stopped) return;
      const token = await read();
      if (stopped) return;
      if (presence.current.see(token ? codeIdentity(token) : null, Date.now()) && token) report.current(token);
      timer = setTimeout(loop, SCAN_EVERY_MS);
    };
    void loop();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [state, active]);

  async function toggleTorch() {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    const next = torch !== "on";
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch(next ? "on" : "off");
    } catch {
      setTorch("unsupported");
    }
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-ink-deep ring-2 ring-ink-line">
      <video ref={video} playsInline muted autoPlay className="h-full w-full object-cover" aria-label={t.door.pointCamera} />

      {state === "running" && (
        <>
          {/* The four corners mark where to hold the code. They light up while one is checked. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-[14%]">
            {["left-0 top-0 border-l-[5px] border-t-[5px] rounded-tl-3xl", "right-0 top-0 border-r-[5px] border-t-[5px] rounded-tr-3xl",
              "left-0 bottom-0 border-l-[5px] border-b-[5px] rounded-bl-3xl", "right-0 bottom-0 border-r-[5px] border-b-[5px] rounded-br-3xl"].map((corner) => (
              <span key={corner} className={`absolute h-12 w-12 transition-colors duration-150 ${checking ? "border-go" : "border-paper"} ${corner}`} />
            ))}
          </div>

          {/* The moment a code is read, say so — before the answer is back. On a slow
              connection this is what stops staff waving the phone about. */}
          {checking && (
            <div className="absolute inset-0 grid place-items-center bg-ink-deep/70" role="status">
              <p className="display rounded-full bg-paper px-6 py-3 text-2xl text-ink-deep">{t.door.checking}</p>
            </div>
          )}

          {torch !== "unsupported" && (
            <button
              type="button"
              onClick={toggleTorch}
              aria-pressed={torch === "on"}
              aria-label={t.door.torch}
              className={`absolute bottom-3 right-3 grid h-14 w-14 place-items-center rounded-full border-2 ${
                torch === "on" ? "border-paper bg-paper text-ink-deep" : "border-paper bg-ink-deep/70 text-paper"
              }`}
            >
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 3h8l-1.5 5.5h-5L8 3Z" />
                <path d="M9.5 8.5h5V19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2V8.5Z" />
                <path d="M12 12.5v2.5" />
              </svg>
            </button>
          )}
        </>
      )}

      {state !== "running" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="max-w-[18rem] text-paper-light">
            {state === "starting" ? t.common.loading : state === "blocked" ? t.door.cameraBlocked : t.door.cameraMissing}
          </p>
          {state === "blocked" && (
            <button
              type="button"
              className="btn btn-paper"
              onClick={() => {
                setState("starting");
                setAttempt((n) => n + 1);
              }}
            >
              {t.door.startCamera}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
