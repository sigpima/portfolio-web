"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NOT_INVITED, parseInviteSession, type InviteSession } from "./types";

export type InviteSessionState = { ready: boolean } & InviteSession;

const INITIAL: InviteSessionState = { ready: false, ...NOT_INVITED };
const FAILED: InviteSessionState = { ready: true, ...NOT_INVITED };

const InviteSessionContext = createContext<InviteSessionState>(INITIAL);

export interface InviteSessionActions {
  /**
   * Forgets the invite for this page view (e.g. the server answered 401 `invite_required`):
   * every consumer switches to "not invited" at once, without a reload or a refetch.
   */
  invalidate(): void;
}

const InviteSessionActionsContext = createContext<InviteSessionActions>({ invalidate: () => {} });

/** Fetches `/api/session` once and shares the result with every `useInviteSession` below it. */
export function InviteSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<InviteSessionState>(INITIAL);
  /** Set once invalidated, so a late `/api/session` answer cannot bring the invite back. */
  const invalidated = useRef(false);
  const actions = useMemo<InviteSessionActions>(
    () => ({
      invalidate: () => {
        invalidated.current = true;
        setState(FAILED);
      },
    }),
    [],
  );

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
        if (!controller.signal.aborted && !invalidated.current) {
          setState(session ? { ready: true, ...session } : FAILED);
        }
      } catch {
        if (!controller.signal.aborted && !invalidated.current) setState(FAILED);
      }
    })();
    return () => controller.abort();
  }, []);

  return (
    <InviteSessionActionsContext.Provider value={actions}>
      <InviteSessionContext.Provider value={state}>{children}</InviteSessionContext.Provider>
    </InviteSessionActionsContext.Provider>
  );
}

/** Invite state of the current visitor; `ready` is false until `/api/session` has answered. */
export function useInviteSession(): InviteSessionState {
  return useContext(InviteSessionContext);
}

/** Actions on the shared invite state (a no-op outside `InviteSessionProvider`). */
export function useInviteSessionActions(): InviteSessionActions {
  return useContext(InviteSessionActionsContext);
}
