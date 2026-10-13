"use client";

import type { ReactNode } from "react";
import { Dock, TopBar } from "@/components/app-chrome";
import { MeProvider, useMe } from "@/components/me";
import type { Me } from "@/lib/types";

export function MemberChrome({ me, children }: { me: Me; children: ReactNode }) {
  return (
    <MeProvider initial={me}>
      <TopBar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8 pt-6">{children}</main>
      <MemberDock />
    </MeProvider>
  );
}

function MemberDock() {
  const { me } = useMe();
  return <Dock role={me.role} invitesWaiting={me.pendingInvites} />;
}
