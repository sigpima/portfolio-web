"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { knowledgeBaseReplay } from "@/content/replays/knowledge-base";
import type { Locale } from "@/content/types";
import { useInviteSession, useInviteSessionActions } from "@/lib/invite/use-invite-session";
import { KnowledgeBaseDemo } from "./KnowledgeBaseDemo";
import { ReplayDemo } from "./ReplayDemo";

/**
 * The Knowledge Base demo for this visitor: the live chat only with an invite that
 * includes chat, otherwise a replay of recorded runs (no `/api/chat/*` call at all).
 * While the invite session is unknown it shows a neutral block, so neither mode flashes.
 */
export function KnowledgeBaseSwitch({ locale }: { locale: Locale }) {
  const t = useTranslations("kb");
  const activeLocale = useLocale();
  const { ready, invited, features } = useInviteSession();
  const { invalidate } = useInviteSessionActions();
  /** The invite stopped working during this visit (401 from the chat proxy). */
  const [inviteLost, setInviteLost] = useState(false);
  const lostRef = useRef<HTMLParagraphElement>(null);

  const onInviteRequired = useCallback(() => {
    setInviteLost(true);
    // Everyone on the page (badges included) drops the invite, without a reload.
    invalidate();
  }, [invalidate]);

  // The live demo (and the focused input) just went away: move focus to the explanation.
  useEffect(() => {
    if (inviteLost) lostRef.current?.focus();
  }, [inviteLost]);

  if (!ready) {
    return (
      <div
        data-kb-mode="pending"
        aria-busy="true"
        lang={activeLocale}
        className="flex min-h-[250px] items-center justify-center rounded-xl border border-outline-variant bg-surface-container p-4"
      >
        <p className="text-body-md text-on-surface-variant">{t("modeLoading")}</p>
      </div>
    );
  }

  if (invited && features.chat && !inviteLost) {
    return <KnowledgeBaseDemo locale={locale} onInviteRequired={onInviteRequired} />;
  }

  return (
    <div data-kb-mode="replay" lang={activeLocale} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-body-md">
        {inviteLost ? (
          <p ref={lostRef} tabIndex={-1} role="status" className="font-semibold text-on-surface">
            {t("errors.inviteRequired")}
          </p>
        ) : null}
        <p className="text-on-surface-variant">{t("replayNotice")}</p>
      </div>
      <ReplayDemo definition={knowledgeBaseReplay} kind="replay" locale={locale} />
    </div>
  );
}
