import { describe, expect, it } from "vitest";
import { projects } from "@/content/registry";
import { giaPhaSimulation, twistfitLive } from "@/test-utils/twistfit-live";
import { replaysByDemoComponent } from "@/content/replays";
import { KnowledgeBaseSwitch } from "./KnowledgeBaseSwitch";
import { TwistfitSwitch } from "./TwistfitSwitch";
import { demoComponents } from "./registry";
import { replayDemoComponents } from "./replay-demos";

/**
 * Live demos that fall back to a replay: the Knowledge Base and Twistfit, reached through a
 * Switch registered outside `replayDemoComponents` (the replay itself is still in `replaysByDemoComponent`).
 */
const LIVE_WITH_REPLAY: Record<string, unknown> = {
  "knowledge-base": KnowledgeBaseSwitch,
  twistfit: TwistfitSwitch,
};

describe("demo registries stay in sync", () => {
  it("every replay definition has a registered demo component, and vice versa", () => {
    const withReplay = [...Object.keys(replayDemoComponents), ...Object.keys(LIVE_WITH_REPLAY)].sort();
    expect(Object.keys(replaysByDemoComponent).sort()).toEqual(withReplay);
    for (const key of Object.keys(replaysByDemoComponent)) expect(demoComponents[key], key).toBeDefined();
  });

  it("replayDemoComponents keeps only the Gia phả simulation", () => {
    expect(Object.keys(replayDemoComponents)).toEqual(["gia-pha-simulation"]);
  });

  it("every replay demo component is registered in demoComponents", () => {
    for (const key of Object.keys(replayDemoComponents)) {
      expect(demoComponents[key]).toBe(replayDemoComponents[key]);
    }
  });

  it("live demos with a replay fallback are registered through their switch", () => {
    for (const [key, component] of Object.entries(LIVE_WITH_REPLAY)) {
      expect(demoComponents[key], key).toBe(component);
    }
  });

  it("every replay/simulation project, and every live project with a replay, points at a key in both registries", () => {
    // Twistfit and Gia phả are shown as "demo coming soon" for now; their demo code is checked
    // through the fixtures that switch the demo back on.
    const withReplay = [...projects, twistfitLive, giaPhaSimulation].filter(
      (p) =>
        p.demoKind === "replay" ||
        p.demoKind === "simulation" ||
        (p.demoKind === "live" && (p.demo?.component ?? "") in LIVE_WITH_REPLAY),
    );
    expect(withReplay.map((p) => p.slug)).toEqual(expect.arrayContaining(["knowledge-base", "twistfit"]));
    for (const project of withReplay) {
      const key = project.demo?.component ?? "";
      expect(replaysByDemoComponent[key], project.slug).toBeDefined();
      expect(demoComponents[key], project.slug).toBeDefined();
    }
  });
});
