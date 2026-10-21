import { describe, expect, it } from "vitest";
import { getProject } from "../registry";
import type { Project } from "../types";
import { isPlaceholderDemo } from "./index";
import type { ReplayDefinition, ReplaySample } from "./types";

function sample(id: string, placeholder?: boolean): ReplaySample {
  return {
    id,
    title: { vi: id, en: id },
    placeholder,
    input: { kind: "file", fileName: "x.docx", excerpt: { vi: [], en: [] } },
    nodes: [{ id: "a", label: { vi: "A", en: "A" } }],
    steps: [{ atMs: 0, nodeId: "a", status: "done" }],
    result: { kind: "people", people: [] },
  };
}

const twistfit = getProject("twistfit")!;
const withComponent = (component: string): Project => ({ ...twistfit, demo: { component } });

describe("isPlaceholderDemo", () => {
  const map: Record<string, ReplayDefinition> = {
    all: { id: "all", samples: [sample("1", true), sample("2", true)] },
    mixed: { id: "mixed", samples: [sample("1", true), sample("2", false)] },
    none: { id: "none", samples: [sample("1"), sample("2", false)] },
    empty: { id: "empty", samples: [] },
  };

  it("is true only when every sample of the project's replay is a placeholder", () => {
    expect(isPlaceholderDemo(withComponent("all"), map)).toBe(true);
    expect(isPlaceholderDemo(withComponent("mixed"), map)).toBe(false);
    expect(isPlaceholderDemo(withComponent("none"), map)).toBe(false);
    expect(isPlaceholderDemo(withComponent("empty"), map)).toBe(false);
    expect(isPlaceholderDemo(withComponent("unknown"), map)).toBe(false);
    expect(isPlaceholderDemo({ ...twistfit, demo: undefined }, map)).toBe(false);
  });

  it("reads the real replay data: Twistfit is a placeholder today, Knowledge Base and Gia phả are not", () => {
    expect(isPlaceholderDemo(twistfit)).toBe(true);
    expect(isPlaceholderDemo(getProject("knowledge-base")!)).toBe(false);
    expect(isPlaceholderDemo(getProject("gia-pha")!)).toBe(false);
  });
});

describe("Twistfit copy", () => {
  it("does not assert that the demo is a replay of a real run (vi and en)", () => {
    const texts = (["summary", "problem", "approach", "tagline"] as const).flatMap((k) => [
      twistfit[k].vi,
      twistfit[k].en,
    ]);
    texts.push(...twistfit.highlights.vi, ...twistfit.highlights.en);
    for (const text of texts) {
      expect(text).not.toMatch(/lần chạy thật/i);
      expect(text).not.toMatch(/real run/i);
    }
  });
});
