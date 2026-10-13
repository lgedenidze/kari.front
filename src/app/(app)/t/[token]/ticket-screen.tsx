"use client";

import { useCallback, useState } from "react";
import { FormError } from "@/components/field";
import { LiveTicket } from "@/components/live-ticket";
import { usePoll } from "@/components/me";
import { SaveToPhone } from "@/components/save-to-phone";
import { useI18n } from "@/i18n/provider";
import { api, isApiError } from "@/lib/api";
import type { TicketResponse } from "@/lib/types";

export function TicketScreen({ token }: { token: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<TicketResponse | null>(null);
  const [missing, setMissing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.get<TicketResponse>(`/tickets/${encodeURIComponent(token)}`));
      setFailure(null);
    } catch (error) {
      if (isApiError(error) && error.status === 404) setMissing(true);
      else setFailure(isApiError(error) ? error.code : "server_error");
    }
  }, [token]);

  usePoll(load, 6000, !missing);

  if (missing) {
    return (
      <div className="paper rise w-full p-6">
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
      <div className="ticket h-[30rem] w-full max-w-[22rem] animate-pulse opacity-40" aria-label={t.common.loading} />
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
