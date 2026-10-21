import type { ComponentType } from "react";
import type { Locale } from "@/content/types";
import { KnowledgeBaseSwitch } from "./KnowledgeBaseSwitch";
import { replayDemoComponents } from "./replay-demos";

/** Demo components by `Project.demo.component` key. */
export const demoComponents: Record<string, ComponentType<{ locale: Locale }>> = {
  // Live with an invite, a replay of recorded runs without one.
  "knowledge-base": KnowledgeBaseSwitch,
  ...replayDemoComponents,
};
