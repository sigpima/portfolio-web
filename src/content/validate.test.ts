import { describe, expect, it } from "vitest";
import { validateProjects } from "./validate";
import type { Project } from "./types";

const known = ["demo-a", "demo-b"];

function make(overrides: Partial<Project> = {}): Project {
  return {
    slug: "sample",
    group: "website",
    demoKind: "none",
    featured: false,
    order: 1,
    title: { vi: "Tiêu đề", en: "Title" },
    tagline: { vi: "Khẩu hiệu", en: "Tagline" },
    summary: { vi: "Tóm tắt", en: "Summary" },
    problem: { vi: "Vấn đề", en: "Problem" },
    approach: { vi: "Cách làm", en: "Approach" },
    highlights: { vi: ["Một"], en: ["One"] },
    tech: ["TypeScript"],
    links: [],
    cover: "/projects/sample.svg",
    ...overrides,
  };
}

describe("validateProjects", () => {
  it("accepts a valid list", () => {
    const list = [
      make({ slug: "a", demoKind: "live", demo: { component: "demo-a" } }),
      make({ slug: "b" }),
    ];
    expect(validateProjects(list, known)).toEqual([]);
  });

  it("reports duplicate slugs", () => {
    const errors = validateProjects([make({ slug: "a" }), make({ slug: "a" })], known);
    expect(errors.some((e) => e.startsWith("a:") && /slug trùng/.test(e))).toBe(true);
  });

  it("reports an empty Localized string in vi or en", () => {
    const viEmpty = validateProjects([make({ title: { vi: "", en: "Title" } })], known);
    const enBlank = validateProjects([make({ summary: { vi: "Tóm tắt", en: "   " } })], known);
    expect(viEmpty.some((e) => e.includes("title") && e.includes("vi"))).toBe(true);
    expect(enBlank.some((e) => e.includes("summary") && e.includes("en"))).toBe(true);
  });

  it("reports empty highlight lists or entries", () => {
    expect(
      validateProjects([make({ highlights: { vi: [], en: ["One"] } })], known).length,
    ).toBeGreaterThan(0);
    expect(
      validateProjects([make({ highlights: { vi: ["Một"], en: [""] } })], known).length,
    ).toBeGreaterThan(0);
  });

  it("reports a demoKind other than none without a demo", () => {
    const errors = validateProjects([make({ demoKind: "replay" })], known);
    expect(errors.some((e) => e.includes("thiếu demo"))).toBe(true);
  });

  it("reports a demo component that is not a known demo", () => {
    const errors = validateProjects(
      [make({ demoKind: "live", demo: { component: "missing" } })],
      known,
    );
    expect(errors.some((e) => e.includes("missing"))).toBe(true);
  });

  it("reports a demo present when demoKind is none", () => {
    const errors = validateProjects([make({ demo: { component: "demo-a" } })], known);
    expect(errors.some((e) => e.includes('"none" nhưng lại có demo'))).toBe(true);
  });

  it("accepts demoSoon with a none demo and an https website", () => {
    const errors = validateProjects([make({ demoSoon: true, website: "https://example.com" })], known);
    expect(errors).toEqual([]);
  });

  it("reports demoSoon together with a demo kind", () => {
    const errors = validateProjects(
      [make({ demoKind: "live", demo: { component: "demo-a" }, demoSoon: true })],
      known,
    );
    expect(errors.some((e) => e.includes("demoSoon"))).toBe(true);
  });

  it("reports a website that is not an https address", () => {
    for (const website of ["http://example.com", "example.com", "javascript:alert(1)", "https://"]) {
      const errors = validateProjects([make({ website })], known);
      expect(errors.some((e) => e.includes("website")), website).toBe(true);
    }
  });
});
