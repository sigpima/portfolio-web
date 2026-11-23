import { getProject } from "@/content/registry";
import type { Project } from "@/content/types";

/**
 * Twistfit as it would be with its demo switched on again. The site currently shows Twistfit as
 * "demo coming soon" (demoKind "none"), but the live/replay demo code is kept and still tested
 * through this fixture so it cannot rot.
 */
export const twistfitLive: Project = {
  ...getProject("twistfit")!,
  demoKind: "live",
  demo: { component: "twistfit" },
  demoSoon: false,
};

/** Gia phả as it would be with its simulation switched on again (same reason as above). */
export const giaPhaSimulation: Project = {
  ...getProject("gia-pha")!,
  demoKind: "simulation",
  demo: { component: "gia-pha-simulation" },
  demoSoon: false,
};
