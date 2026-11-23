"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useInviteSession, useInviteSessionActions } from "@/lib/invite/use-invite-session";

/** Longest message portfolio-api stores (characters). */
export const MAX_FEEDBACK_CHARS = 1000;

type Outcome = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; key: ErrorKey };
type ErrorKey = "rateLimited" | "inviteLost" | "invalid" | "failed";

function errorKeyFor(status: number, code: unknown): ErrorKey {
  if (status === 401 && code === "invite_required") return "inviteLost";
  if (status === 429) return "rateLimited";
  if (status === 422 || status === 413) return "invalid";
  return "failed";
}

/**
 * One line of feedback. With an invite link it is saved by portfolio-api against that link
 * (`POST /api/feedback`). Without one nothing can be saved, so the button opens the visitor's own
 * email app with the message filled in (`mailto:`); the note under the field says which of the two
 * will happen, and never claims the page sends anything it does not.
 */
export function FeedbackField({ email }: { email: string }) {
  const t = useTranslations("home.contact.feedback");
  const id = useId();
  const { ready, invited } = useInviteSession();
  const { invalidate } = useInviteSessionActions();
  const [message, setMessage] = useState("");
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  /** Set while a request is in flight, so a double click or Enter sends once. */
  const sending = useRef(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (sending.current) return;
    if (!text) {
      setOutcome({ kind: "error", key: "invalid" });
      return;
    }
    if (!invited) {
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(t("subject"))}&body=${encodeURIComponent(text)}`;
      return;
    }
    sending.current = true;
    setOutcome({ kind: "sending" });
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        setMessage("");
        setOutcome({ kind: "sent" });
        return;
      }
      let code: unknown = null;
      try {
        code = ((await res.json()) as { code?: unknown }).code;
      } catch {
        // not JSON: treated as a plain failure
      }
      const key = errorKeyFor(res.status, code);
      // The invite stopped working: the field falls back to email for the rest of the visit.
      if (key === "inviteLost") invalidate();
      setOutcome({ kind: "error", key });
    } catch {
      setOutcome({ kind: "error", key: "failed" });
    } finally {
      sending.current = false;
    }
  }

  const busy = outcome.kind === "sending";
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate>
      <label htmlFor={id} className="text-body-md font-semibold text-on-surface">
        {t("label")}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          name="message"
          autoComplete="off"
          maxLength={MAX_FEEDBACK_CHARS}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            if (outcome.kind !== "sending") setOutcome({ kind: "idle" });
          }}
          placeholder={t("placeholder")}
          className="min-h-14 w-full rounded-xl border border-outline-variant bg-surface-container py-3 pr-16 pl-4 text-body-lg text-on-surface placeholder:text-on-surface-variant focus-visible:border-secondary"
        />
        <button
          type="submit"
          aria-label={busy ? t("sending") : t("submit")}
          aria-disabled={busy ? true : undefined}
          className="absolute top-1/2 right-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-primary-container text-headline-md text-on-primary-container transition-colors hover:bg-primary-fixed aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
      {outcome.kind === "sent" ? (
        <p role="status" className="text-body-md font-semibold text-secondary">
          {t("sent")}
        </p>
      ) : outcome.kind === "error" ? (
        <p role="alert" className="text-body-md font-semibold text-error">
          {t(`errors.${outcome.key}`)}
        </p>
      ) : null}
      {ready ? <p className="text-body-md text-on-surface-variant">{invited ? t("noteInvited") : t("noteMail")}</p> : null}
    </form>
  );
}
