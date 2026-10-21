/*
 * Placeholder wording derived from replay data alone (no imports of the replay data itself,
 * so client components can use it without bundling every replay).
 */
import type { ReplayDefinition, ReplaySample } from "./types";

/**
 * Which placeholder wording applies: `"placeholder"` ("images and facts") when the samples
 * show images, `"placeholderFacts"` ("facts" only) when they have none (e.g. Knowledge Base).
 * Both are message keys under `demo.badgeQualifier`.
 */
export type PlaceholderQualifier = "placeholder" | "placeholderFacts";

/** True when the sample shows images (as input or as result). */
export function sampleHasImages(sample: ReplaySample): boolean {
  return sample.input.kind === "images" || sample.result.kind === "images";
}

/** The placeholder wording for these samples: with images if any of them shows images. */
export function placeholderVariantOf(samples: readonly ReplaySample[]): PlaceholderQualifier {
  return samples.some(sampleHasImages) ? "placeholder" : "placeholderFacts";
}

/**
 * The placeholder qualifier of a replay definition: set only when EVERY sample is a
 * placeholder, worded after whether the samples show images. Derived from the replay data
 * itself (no separate flag to keep in sync).
 */
export function placeholderQualifierOf(definition: ReplayDefinition | undefined): PlaceholderQualifier | undefined {
  if (!definition || definition.samples.length === 0) return undefined;
  if (!definition.samples.every((sample) => sample.placeholder === true)) return undefined;
  return placeholderVariantOf(definition.samples);
}
