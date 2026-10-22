"use client";

import type { PlaceholderQualifier } from "@/content/replays/placeholder";
import type { Locale } from "@/content/types";
import { useInviteSession } from "@/lib/invite/use-invite-session";
import { DemoBadge } from "./DemoBadge";
import type { LiveFeature } from "./live-feature";

/**
 * In-demo badge of a live project, which is live only for invited visitors:
 * "live" with an invite that includes the demo's feature (chat by default), otherwise the replay badge the visitor
 * actually gets (qualified when its samples are placeholders). Nothing until the
 * session is known, so a wrong label never flashes.
 */
export function LiveAwareBadge({
  locale,
  replayQualifier,
  feature = "chat",
}: {
  locale: Locale;
  replayQualifier?: PlaceholderQualifier;
  /** The invite feature this live demo needs. */
  feature?: LiveFeature;
}) {
  const { ready, invited, features } = useInviteSession();
  if (!ready) return null;
  if (invited && features[feature]) return <DemoBadge kind="live" locale={locale} />;
  return <DemoBadge kind="replay" locale={locale} qualifier={replayQualifier} />;
}
