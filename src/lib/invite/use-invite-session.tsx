"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { NOT_INVITED, parseInviteSession, type InviteSession } from "./types";

export type InviteSessionState = { ready: boolean } & InviteSession;

const INITIAL: InviteSessionState = { ready: false, ...NOT_INVITED };
const FAILED: InviteSessionState = { ready: true, ...NOT_INVITED };

const InviteSessionContext = createContext<InviteSessionState>(INITIAL);

/** Fetches `/api/session` once and shares the result with every `useInviteSession` below it. */
export function InviteSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<InviteSessionState>(INITIAL);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/session", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const session = res.ok ? parseInviteSession(await res.json()) : null;
        if (!controller.signal.aborted) setState(session ? { ready: true, ...session } : FAILED);
      } catch {
        if (!controller.signal.aborted) setState(FAILED);
      }
    })();
    return () => controller.abort();
  }, []);

  return <InviteSessionContext.Provider value={state}>{children}</InviteSessionContext.Provider>;
}

/** Invite state of the current visitor; `ready` is false until `/api/session` has answered. */
export function useInviteSession(): InviteSessionState {
  return useContext(InviteSessionContext);
}
