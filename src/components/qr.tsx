"use client";

import { useMemo } from "react";
import QRCode from "qrcode";

/**
 * Draws a QR code as one SVG path in the current text colour. No quiet zone is drawn here —
 * the caller gives it padding, on the lightest surface available.
 */
export function Qr({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const { path, size } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
    let d = "";
    for (let y = 0; y < modules.size; y++) {
      for (let x = 0; x < modules.size; x++) {
        if (modules.data[y * modules.size + x]) d += `M${x} ${y}h1v1h-1z`;
      }
    }
    return { path: d, size: modules.size };
  }, [value]);

  return (
    // data-value repeats what the code already says, in a form the end-to-end tests can read.
    <svg viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" role="img" aria-label={label} data-value={value} className={className}>
      <path d={path} fill="currentColor" />
    </svg>
  );
}
