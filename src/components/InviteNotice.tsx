"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * A short notice for `?invite=invalid` (the invite route bounced the visitor here).
 * It says nothing about why, and never echoes a query value. The param is removed from
 * the address bar without a reload so a refresh does not bring the notice back; the
 * notice itself is latched in state, so it survives that URL change and, once dismissed,
 * stays hidden for the rest of this page view (nothing is stored).
 * Mount it inside a Suspense boundary: it reads the query string on the client.
 */
export function InviteNotice() {
  const t = useTranslations("invite");
  const invalid = useSearchParams().get("invite") === "invalid";
  // Latched while rendering: the notice must outlive our own removal of the param below.
  const [seen, setSeen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  if (invalid && !seen) setSeen(true);
  const open = !dismissed && (invalid || seen);

  useEffect(() => {
    if (!invalid) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("invite");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [invalid]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDismissed(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-margin">
      <div
        className="pointer-events-auto flex max-w-xl items-start gap-3 rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface shadow-lg shadow-black/30"
      >
        <p role="status">{t("notice")}</p>
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
