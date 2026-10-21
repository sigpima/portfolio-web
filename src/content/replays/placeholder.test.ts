import { describe, expect, it } from "vitest";
import { getProject } from "../registry";
import type { Project } from "../types";
import { isPlaceholderDemo, placeholderQualifier, placeholderQualifierOf, replaysByDemoComponent } from "./index";
import { knowledgeBaseReplayFor } from "./knowledge-base";
import { recordedSamples } from "./knowledge-base.recorded";
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

  it("reads the real replay data: Twistfit is a placeholder today, Gia phả is not", () => {
    expect(isPlaceholderDemo(twistfit)).toBe(true);
    expect(isPlaceholderDemo(getProject("gia-pha")!)).toBe(false);
  });

  it("Knowledge Base: placeholder exactly while no recorded sample exists", () => {
    const kb = getProject("knowledge-base")!;
    expect(isPlaceholderDemo(kb)).toBe(recordedSamples.length === 0);

    const empty = knowledgeBaseReplayFor([]);
    expect(empty.samples).toHaveLength(1);
    expect(empty.samples[0].placeholder).toBe(true);
    expect(isPlaceholderDemo(kb, { ...replaysByDemoComponent, "knowledge-base": empty })).toBe(true);

    const real: ReplaySample = {
      ...sample("real"),
      input: { kind: "question", text: { vi: "Q", en: "Q" } },
      result: { kind: "text", text: { vi: "A", en: "A" } },
    };
    const recorded = knowledgeBaseReplayFor([real]);
    expect(recorded.samples).toEqual([real]);
    expect(isPlaceholderDemo(kb, { ...replaysByDemoComponent, "knowledge-base": recorded })).toBe(false);
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

describe("placeholder wording variant", () => {
  const image = { src: "/x.svg", alt: { vi: "x", en: "x" } };
  const withImagesIn: ReplaySample = { ...sample("in", true), input: { kind: "images", items: [image] } };
  const withImagesOut: ReplaySample = { ...sample("out", true), result: { kind: "images", items: [image] } };

  it("is placeholderFacts when no sample shows images, placeholder when any does", () => {
    expect(placeholderQualifierOf({ id: "a", samples: [sample("1", true)] })).toBe("placeholderFacts");
    expect(placeholderQualifierOf({ id: "b", samples: [sample("1", true), withImagesIn] })).toBe("placeholder");
    expect(placeholderQualifierOf({ id: "c", samples: [withImagesOut] })).toBe("placeholder");
    expect(placeholderQualifierOf({ id: "d", samples: [sample("1", true), sample("2", false)] })).toBeUndefined();
    expect(placeholderQualifierOf({ id: "e", samples: [] })).toBeUndefined();
    expect(placeholderQualifierOf(undefined)).toBeUndefined();
  });

  it("reads the real data: Twistfit (images) keeps the images wording, Knowledge Base gets facts", () => {
    expect(placeholderQualifier(twistfit)).toBe("placeholder");
    expect(placeholderQualifier(getProject("gia-pha")!)).toBeUndefined();
    const kb = getProject("knowledge-base")!;
    expect(placeholderQualifier(kb)).toBe(recordedSamples.length === 0 ? "placeholderFacts" : undefined);
    expect(placeholderQualifier(kb, { ...replaysByDemoComponent, "knowledge-base": knowledgeBaseReplayFor([]) })).toBe(
      "placeholderFacts",
    );
  });
});
