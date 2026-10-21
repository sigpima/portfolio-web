"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useInviteSession } from "@/lib/invite/use-invite-session";

/** The `?invite=` values the invite route (`/i/<token>`) redirects with. */
type InviteParam = "ok" | "invalid" | "unavailable";
const PARAMS: readonly string[] = ["ok", "invalid", "unavailable"];

/** Which sentence to show. */
type NoticeKind = "ok" | "okNoSession" | "invalid" | "unavailable";
const MESSAGE_KEY: Record<NoticeKind, "ok" | "okNoSession" | "notice" | "unavailable"> = {
  ok: "ok",
  okNoSession: "okNoSession",
  invalid: "notice",
  unavailable: "unavailable",
};

/**
 * A short notice after the invite route bounced the visitor here:
 * - `?invite=invalid`: the link does not work (never says why);
 * - `?invite=unavailable`: the link could not be opened right now (outage, rate limit);
 * - `?invite=ok`: once the invite session is known, either a confirmation, or a warning that
 *   the browser did not keep the session (cookies blocked, in-app browser).
 * It never echoes a query value. The param is removed from the address bar without a reload so
 * a refresh does not bring the notice back; the notice itself is latched in state, so it
 * survives that URL change and, once dismissed, stays hidden for the rest of this page view
 * (nothing is stored). It never takes focus.
 * Mount it inside a Suspense boundary (it reads the query string on the client) and inside
 * `InviteSessionProvider` (the `/i/` redirect is a full navigation, so that provider fetches
 * the fresh session on this very page load).
 */
export function InviteNotice() {
  const t = useTranslations("invite");
  const raw = useSearchParams().get("invite");
  const param = raw !== null && PARAMS.includes(raw) ? (raw as InviteParam) : null;
  const session = useInviteSession();
  // Latched while rendering: the notice must outlive our own removal of the param below.
  const [seen, setSeen] = useState<InviteParam | null>(null);
  const [okOutcome, setOkOutcome] = useState<"ok" | "okNoSession" | null>(null);
  const [dismissed, setDismissed] = useState(false);
  if (param && !seen) setSeen(param);
  const current = seen ?? param;
  // The outcome of `ok` is decided once, when the session first becomes known.
  if (current === "ok" && okOutcome === null && session.ready) {
    setOkOutcome(session.invited ? "ok" : "okNoSession");
  }
  const kind: NoticeKind | null = current === "ok" ? okOutcome : current;
  const open = !dismissed && kind !== null;

  useEffect(() => {
    if (!param) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("invite");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [param]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDismissed(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || kind === null) return null;

  const warning = kind === "okNoSession";
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-margin">
      <div
        data-invite-notice={kind}
        className={`pointer-events-auto flex max-w-xl items-start gap-3 rounded-lg border px-4 py-3 text-body-md text-on-surface shadow-lg shadow-black/30 ${
          warning ? "border-error bg-surface-container" : kind === "ok" ? "border-secondary bg-surface-container" : "border-outline-variant bg-surface-container"
        }`}
      >
        <p role="status">{t(MESSAGE_KEY[kind])}</p>
        <button
          type="button"
          aria-label={t("dismiss")}
          onClick={() => setDismissed(true)}
          className="-my-1 -mr-2 flex size-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant hover:text-on-surface"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </div>
  );
}
