import type { ComponentType } from "react";
import type { Locale } from "@/content/types";
import { KnowledgeBaseSwitch } from "./KnowledgeBaseSwitch";
import { GiaPhaSimulationDemo } from "./replay-demos";
import { TwistfitSwitch } from "./TwistfitSwitch";

/** Demo components by `Project.demo.component` key. */
export const demoComponents: Record<string, ComponentType<{ locale: Locale }>> = {
  // Live with an invite, a replay of recorded runs without one.
  "knowledge-base": KnowledgeBaseSwitch,
  // Live with an invite that includes Twistfit, a replay of the sample run without one.
  twistfit: TwistfitSwitch,
  // Named explicitly: `replay-demos.tsx` is a "use client" module, and a server module cannot
  // spread an object exported from it (the client reference has no enumerable keys), which left
  // the Gia phả page without its demo in the production build.
  "gia-pha-simulation": GiaPhaSimulationDemo,
};
