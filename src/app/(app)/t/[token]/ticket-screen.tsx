"use client";

import { FormError } from "@/components/field";
import { LiveTicket } from "@/components/live-ticket";
import { TicketSkeleton } from "@/components/loading";
import { SaveToPhone } from "@/components/save-to-phone";
import { useLive } from "@/components/use-live";
import { useI18n } from "@/i18n/provider";
import type { TicketResponse } from "@/lib/types";

export function TicketScreen({ token, first }: { token: string; first: TicketResponse | null }) {
  const { t } = useI18n();
  const { data, failure, missing } = useLive<TicketResponse>(`/tickets/${encodeURIComponent(token)}`, { every: 6000, first });

  if (missing) {
    return (
      <div className="paper w-full p-6">
        <h1 className="text-3xl">{t.ticket.notFoundTitle}</h1>
        <p className="mt-3 text-paper-soft">{t.ticket.notFoundBody}</p>
      </div>
    );
  }

  if (!data) {
    return failure ? (
      <div className="w-full">
        <FormError code={failure} />
      </div>
    ) : (
      <TicketSkeleton />
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <LiveTicket ticket={data.ticket} serverTime={data.serverTime} tonight={data.tonight} />
      <SaveToPhone />
      <p className="text-center text-sm text-ink-soft">{t.ticket.keepPage}</p>
    </div>
  );
}
