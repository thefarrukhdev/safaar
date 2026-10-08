"use client";

import { createContext, useContext, ReactNode } from "react";
import type { Session } from "@/lib/auth/session";

interface SessionContextValue {
  session: Session | null;
  authed: boolean;
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  authed: false,
});

export function SessionProvider({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  return (
    <SessionContext.Provider value={{ session, authed: !!session }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
