"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/provider";

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

const SCAN_EVERY_MS = 140;
/** The same code held in front of the camera is reported once, not seven times a second. */
const REPEAT_AFTER_MS = 4000;

export function Scanner({ active, onToken }: { active: boolean; onToken: (token: string) => void }) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const last = useRef({ token: "", at: 0 });
  const report = useRef(onToken);
  const [state, setState] = useState<CameraState>("starting");
  // Bumped by the retry button: each attempt is one run of the effect below.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    report.current = onToken;
  });

  useEffect(() => {
    let cancelled = false;
    // A browser with no camera API is treated like a device with no camera.
    const request =
      navigator.mediaDevices?.getUserMedia?.({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
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

  useEffect(() => {
    if (state !== "running" || !active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const canvas = document.createElement("canvas");
    const native = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
    let jsqr: typeof import("jsqr").default | null = null;

    const read = async (): Promise<string | null> => {
      const element = video.current;
      if (!element || element.readyState < 2 || element.videoWidth === 0) return null;

      if (native) {
        const found = await native.detect(element).catch(() => []);
        return found[0]?.rawValue ?? null;
      }

      jsqr ??= (await import("jsqr")).default;
      // 640px across is plenty for a QR held at arm's length, and four times cheaper than 1280.
      const scale = Math.min(1, 640 / element.videoWidth);
      canvas.width = Math.round(element.videoWidth * scale);
      canvas.height = Math.round(element.videoHeight * scale);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;
      context.drawImage(element, 0, 0, canvas.width, canvas.height);
      const frame = context.getImageData(0, 0, canvas.width, canvas.height);
      return jsqr(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" })?.data || null;
    };

    const loop = async () => {
      if (stopped) return;
      const token = await read();
      if (stopped) return;
      const now = Date.now();
      if (token && (token !== last.current.token || now - last.current.at > REPEAT_AFTER_MS)) {
        last.current = { token, at: now };
        report.current(token);
      }
      timer = setTimeout(loop, SCAN_EVERY_MS);
    };
    void loop();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [state, active]);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-ink-deep">
      <video ref={video} playsInline muted autoPlay className="h-full w-full object-cover" aria-label={t.door.pointCamera} />

      {state === "running" && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-[13%]">
          {["left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl",
            "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl"].map((corner) => (
            <span key={corner} className={`absolute h-10 w-10 border-paper ${corner}`} />
          ))}
        </div>
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
