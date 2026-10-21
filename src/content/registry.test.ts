import { describe, expect, it } from "vitest";
import { getProject, listProjects, projects } from "./registry";
import { validateProjects } from "./validate";

describe("project registry", () => {
  it("is valid against the known demo components", () => {
    expect(
      validateProjects(projects, ["knowledge-base", "twistfit-replay", "gia-pha-simulation"]),
    ).toEqual([]);
  });

  it("maps each project to its demo kind", () => {
    expect(getProject("knowledge-base")?.demoKind).toBe("live");
    expect(getProject("twistfit")?.demoKind).toBe("replay");
    expect(getProject("gia-pha")?.demoKind).toBe("simulation");
    expect(getProject("nope")).toBeUndefined();
  });

  it("lists exactly two website projects", () => {
    const slugs = listProjects("website").map((p) => p.slug);
    expect(slugs).toEqual(["twistfit", "gia-pha"]);
  });

  it("lists the ai-agent group", () => {
    expect(listProjects("ai-agent").map((p) => p.slug)).toEqual(["knowledge-base"]);
  });

  it("returns a copy so callers cannot reorder the registry", () => {
    expect(listProjects()).not.toBe(projects);
  });

  it("never mentions Vast in any project text", () => {
    const text = JSON.stringify(projects);
    expect(text).not.toMatch(/vast/i);
  });

  it("flags Knowledge Base data as synthetic in both taglines", () => {
    const kb = getProject("knowledge-base")!;
    expect(kb.tagline.vi).toContain("dữ liệu giả lập");
    expect(kb.tagline.en).toContain("synthetic data");
  });

  it("puts Knowledge Base first overall", () => {
    const all = listProjects();
    expect(all).toHaveLength(3);
    expect(all[0].slug).toBe("knowledge-base");
    expect(all[0].featured).toBe(true);
  });
});
