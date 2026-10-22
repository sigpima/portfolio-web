import type { Project } from "@/content/types";

/** The invite feature a live demo needs (`useInviteSession().features`). */
export type LiveFeature = "chat" | "twistfit";

/** Live demos that need a feature other than chat, by `Project.demo.component` key. */
const FEATURE_BY_DEMO: Record<string, LiveFeature> = { twistfit: "twistfit" };

/** The invite feature behind the project's live demo; the chat bot unless the demo is listed above. */
export function liveFeatureOf(project: Project): LiveFeature {
  return (project.demo && FEATURE_BY_DEMO[project.demo.component]) || "chat";
}
