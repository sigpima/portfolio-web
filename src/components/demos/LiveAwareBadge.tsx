"use client";

import type { PlaceholderQualifier } from "@/content/replays/placeholder";
import type { Locale } from "@/content/types";
import { useInviteSession } from "@/lib/invite/use-invite-session";
import { DemoBadge } from "./DemoBadge";

/**
 * In-demo badge of a live project, which is live only for invited visitors:
 * "live" with an invite that includes chat, otherwise the replay badge the visitor
 * actually gets (qualified when its samples are placeholders). Nothing until the
 * session is known, so a wrong label never flashes.
 */
export function LiveAwareBadge({
  locale,
  replayQualifier,
}: {
  locale: Locale;
  replayQualifier?: PlaceholderQualifier;
}) {
  const { ready, invited, features } = useInviteSession();
  if (!ready) return null;
  if (invited && features.chat) return <DemoBadge kind="live" locale={locale} />;
  return <DemoBadge kind="replay" locale={locale} qualifier={replayQualifier} />;
}
