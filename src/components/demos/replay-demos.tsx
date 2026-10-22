"use client";

import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
import { giaPhaReplay } from "@/content/replays/gia-pha";
import type { Locale } from "@/content/types";
import { ReplayDemo } from "./ReplayDemo";

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
 * the Knowledge Base and Twistfit replays are the exceptions, reached through `KnowledgeBaseSwitch`
 * and `TwistfitSwitch`.
 */
export const replayDemoComponents: Record<string, ComponentType<{ locale: Locale }>> = {
  "gia-pha-simulation": GiaPhaSimulationDemo,
};
