"use client";

import { useI18n } from "@/i18n/provider";
import type { EntryDecision } from "@/lib/types";

// What the door wrote down, as the chip that ends a row in every list of its records. On the
// door itself the colours are the scanner's; in the back office, the stamps'. An admission
// taken back is neither a yes nor a no, and is quiet.
const TONE: Record<"ink" | "desk", Record<EntryDecision, string>> = {
  ink: { admitted: "text-go", denied: "text-stop", undone: "text-ink-soft" },
  desk: { admitted: "text-stamp-green", denied: "text-stamp-red", undone: "text-desk-soft" },
};

/** The word for a decision, as the door's lists and the receipt under the scanner say it. */
export function useDecisionWord(): (decision: EntryDecision) => string {
  const { t } = useI18n();
  return (decision) => (decision === "admitted" ? t.door.admitted : decision === "denied" ? t.door.denied : t.door.undone);
}

export function decisionTone(decision: EntryDecision, on: "ink" | "desk"): string {
  return TONE[on][decision];
}

export function DecisionChip({ decision, on = "desk", className = "" }: { decision: EntryDecision; on?: "ink" | "desk"; className?: string }) {
  const word = useDecisionWord();
  return <span className={`chip ${TONE[on][decision]} ${className}`}>{word(decision)}</span>;
}
