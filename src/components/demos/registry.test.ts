import { describe, expect, it } from "vitest";
import { projects } from "@/content/registry";
import { replaysByDemoComponent } from "@/content/replays";
import { demoComponents } from "./registry";
import { replayDemoComponents } from "./replay-demos";

describe("demo registries stay in sync", () => {
  it("every replay definition has a replay demo component and vice versa", () => {
    expect(Object.keys(replayDemoComponents).sort()).toEqual(Object.keys(replaysByDemoComponent).sort());
  });

  it("every replay demo component is registered in demoComponents", () => {
    for (const key of Object.keys(replayDemoComponents)) {
      expect(demoComponents[key]).toBe(replayDemoComponents[key]);
    }
  });

  it("every replay/simulation project points at a key present in both registries", () => {
    for (const project of projects.filter((p) => p.demoKind === "replay" || p.demoKind === "simulation")) {
      const key = project.demo?.component ?? "";
      expect(replaysByDemoComponent[key], project.slug).toBeDefined();
      expect(demoComponents[key], project.slug).toBeDefined();
    }
  });
});
