import type { Project } from "../types";
import { giaPhaReplay } from "./gia-pha";
import { knowledgeBaseReplay } from "./knowledge-base";
import { twistfitReplay } from "./twistfit";
import type { ReplayDefinition } from "./types";

/**
 * Replay data by `Project.demo.component` key: replay/simulation demos, plus live demos
 * that fall back to a replay for visitors without an invite (Knowledge Base).
 */
export const replaysByDemoComponent: Record<string, ReplayDefinition> = {
  "knowledge-base": knowledgeBaseReplay,
  "twistfit-replay": twistfitReplay,
  "gia-pha-simulation": giaPhaReplay,
};

/**
 * True when every sample behind the project's demo is a placeholder, derived from
 * the replay data itself (no separate flag to keep in sync).
 */
export function isPlaceholderDemo(
  project: Project,
  replays: Record<string, ReplayDefinition> = replaysByDemoComponent,
): boolean {
  const definition = project.demo ? replays[project.demo.component] : undefined;
  if (!definition || definition.samples.length === 0) return false;
  return definition.samples.every((sample) => sample.placeholder === true);
}
