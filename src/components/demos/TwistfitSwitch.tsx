"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { twistfitReplay } from "@/content/replays/twistfit";
import type { Locale } from "@/content/types";
import { useInviteSession, useInviteSessionActions } from "@/lib/invite/use-invite-session";
import { ReplayDemo } from "./ReplayDemo";
import { TwistfitDemo } from "./TwistfitDemo";

/**
 * The Twistfit demo for this visitor: the live try-on only with an invite that includes
 * Twistfit, otherwise a replay of the sample run (no `/api/twistfit/*` call at all, the
 * catalog included). While the invite session is unknown it shows a neutral block, so
 * neither mode flashes.
 */
export function TwistfitSwitch({ locale }: { locale: Locale }) {
  const t = useTranslations("twistfit");
  const activeLocale = useLocale();
  const { ready, invited, features } = useInviteSession();
  const { invalidate } = useInviteSessionActions();
  /** The invite stopped working during this visit (401 from the Twistfit proxy). */
  const [inviteLost, setInviteLost] = useState(false);
  const lostRef = useRef<HTMLParagraphElement>(null);

  const onInviteRequired = useCallback(() => {
    setInviteLost(true);
    // Everyone on the page (badges included) drops the invite, without a reload.
    invalidate();
  }, [invalidate]);

  // The live demo (and the focused control) just went away: move focus to the explanation.
  useEffect(() => {
    if (inviteLost) lostRef.current?.focus();
  }, [inviteLost]);

  if (!ready) {
    return (
      <div
        data-twistfit-mode="pending"
        aria-busy="true"
        lang={activeLocale}
        className="flex min-h-[250px] items-center justify-center rounded-xl border border-outline-variant bg-surface-container p-4"
      >
        <p className="text-body-md text-on-surface-variant">{t("modeLoading")}</p>
      </div>
    );
  }

  if (invited && features.twistfit && !inviteLost) {
    return <TwistfitDemo locale={locale} onInviteRequired={onInviteRequired} />;
  }

  return (
    <div data-twistfit-mode="replay" lang={activeLocale} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-body-md">
        {inviteLost ? (
          // The link stopped working: say so, without inviting them to "open an invite link" again.
          <p ref={lostRef} tabIndex={-1} role="status" className="font-semibold text-on-surface">
            {t("live.errors.inviteRequired")}
          </p>
        ) : (
          <p className="text-on-surface-variant">
            {invited ? t("replayNoticeNoTwistfit") : t("replayNotice")}
          </p>
        )}
      </div>
      <ReplayDemo definition={twistfitReplay} kind="replay" locale={locale} />
    </div>
  );
}
