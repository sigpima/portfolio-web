import type { Project } from "../types";
import { giaPhaReplay } from "./gia-pha";
import { knowledgeBaseReplay } from "./knowledge-base";
import { twistfitReplay } from "./twistfit";
import { placeholderQualifierOf, type PlaceholderQualifier } from "./placeholder";
import type { ReplayDefinition } from "./types";

export {
  placeholderQualifierOf,
  placeholderVariantOf,
  sampleHasImages,
  type PlaceholderQualifier,
} from "./placeholder";

/**
 * Replay data by `Project.demo.component` key: replay/simulation demos, plus live demos
 * that fall back to a replay for visitors without an invite (Knowledge Base, Twistfit).
 */
export const replaysByDemoComponent: Record<string, ReplayDefinition> = {
  "knowledge-base": knowledgeBaseReplay,
  twistfit: twistfitReplay,
  "gia-pha-simulation": giaPhaReplay,
};

/** The placeholder qualifier of the replay behind the project's demo (see `placeholderQualifierOf`). */
export function placeholderQualifier(
  project: Project,
  replays: Record<string, ReplayDefinition> = replaysByDemoComponent,
): PlaceholderQualifier | undefined {
  return placeholderQualifierOf(project.demo ? replays[project.demo.component] : undefined);
}

/** True when every sample behind the project's demo is a placeholder. */
export function isPlaceholderDemo(
  project: Project,
  replays: Record<string, ReplayDefinition> = replaysByDemoComponent,
): boolean {
  return placeholderQualifier(project, replays) !== undefined;
}
