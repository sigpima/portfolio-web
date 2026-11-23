import { describe, expect, it } from "vitest";
import { getProject, listProjects, projects } from "./registry";
import { validateProjects } from "./validate";

describe("project registry", () => {
  it("is valid against the known demo components", () => {
    expect(
      validateProjects(projects, ["knowledge-base", "twistfit", "gia-pha-simulation"]),
    ).toEqual([]);
  });

  it("maps each project to its demo kind", () => {
    expect(getProject("knowledge-base")?.demoKind).toBe("live");
    // Twistfit and Gia phả have no demo for now: "coming soon", with a link to the real website.
    for (const slug of ["twistfit", "gia-pha"]) {
      const project = getProject(slug)!;
      expect(project.demoKind, slug).toBe("none");
      expect(project.demo, slug).toBeUndefined();
      expect(project.demoSoon, slug).toBe(true);
    }
    expect(getProject("nope")).toBeUndefined();
  });

  it("links each coming-soon project to its real website", () => {
    expect(getProject("gia-pha")?.website).toBe("https://genealogy.sigpima.space");
    expect(getProject("twistfit")?.website).toBe("https://twistfit.org");
  });

  it("lists the known website projects in the website group", () => {
    const slugs = listProjects("website").map((p) => p.slug);
    expect(slugs).toEqual(expect.arrayContaining(["twistfit", "gia-pha"]));
    expect(listProjects("website").every((p) => p.group === "website")).toBe(true);
  });

  it("lists Knowledge Base in the ai-agent group", () => {
    expect(listProjects("ai-agent").map((p) => p.slug)).toContain("knowledge-base");
    expect(listProjects("ai-agent").every((p) => p.group === "ai-agent")).toBe(true);
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
    expect(all.map((p) => p.slug)).toEqual(
      expect.arrayContaining(["knowledge-base", "twistfit", "gia-pha"]),
    );
    expect(all[0].slug).toBe("knowledge-base");
    expect(all[0].featured).toBe(true);
  });

  it("says the KB bot answers in the language of the question, not only in Vietnamese", () => {
    const kb = getProject("knowledge-base")!;
    const vi = [kb.summary.vi, kb.approach.vi, kb.tagline.vi, ...kb.highlights.vi].join(" ");
    const en = [kb.summary.en, kb.approach.en, kb.tagline.en, ...kb.highlights.en].join(" ");
    expect(vi).not.toMatch(/(trả lời|diễn giải) bằng tiếng Việt/);
    expect(en).not.toMatch(/(answers|explains the result) in Vietnamese/);
    expect(kb.summary.vi).toContain("ngôn ngữ của câu hỏi");
    expect(kb.summary.en).toContain("language of the question");
  });
});
