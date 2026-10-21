"use client";

import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
import { giaPhaReplay } from "@/content/replays/gia-pha";
import { twistfitReplay } from "@/content/replays/twistfit";
import type { Locale } from "@/content/types";
import { ReplayDemo } from "./ReplayDemo";

/** Twistfit try-on: a replay (with placeholder samples until real runs are added). */
export function TwistfitReplayDemo({ locale }: { locale: Locale }) {
  return <ReplayDemo definition={twistfitReplay} kind="replay" locale={locale} />;
}

/** Gia phả AI data entry: a simulation of a feature in development. */
export function GiaPhaSimulationDemo({ locale }: { locale: Locale }) {
  const t = useTranslations("demo.giaPha");
  return (
    <ReplayDemo
      definition={giaPhaReplay}
      kind="simulation"
      locale={locale}
      footnote={<p>{t("scansPlanned")}</p>}
    />
  );
}

/**
 * Replay/simulation demos by `Project.demo.component` key. Keep in sync with
 * `replaysByDemoComponent` in `src/content/replays/index.ts` (a test enforces it);
 * the Knowledge Base replay is the exception, reached through `KnowledgeBaseSwitch`.
 */
export const replayDemoComponents: Record<string, ComponentType<{ locale: Locale }>> = {
  "twistfit-replay": TwistfitReplayDemo,
  "gia-pha-simulation": GiaPhaSimulationDemo,
};
