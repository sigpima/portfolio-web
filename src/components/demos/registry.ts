import type { ComponentType } from "react";
import type { Locale } from "@/content/types";
import { KnowledgeBaseDemo } from "./KnowledgeBaseDemo";
import { GiaPhaSimulationDemo, TwistfitReplayDemo } from "./replay-demos";

/** Demo components by `Project.demo.component` key. */
export const demoComponents: Record<string, ComponentType<{ locale: Locale }>> = {
  "knowledge-base": KnowledgeBaseDemo,
  "twistfit-replay": TwistfitReplayDemo,
  "gia-pha-simulation": GiaPhaSimulationDemo,
};
