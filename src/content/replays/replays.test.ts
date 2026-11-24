import { describe, expect, it } from "vitest";
import { existsSync } from "fs";
import path from "path";
import { giaPhaReplay } from "./gia-pha";
import { knowledgeBaseReplay } from "./knowledge-base";
import { twistfitReplay } from "./twistfit";
import type { ReplayDefinition } from "./types";
import viMessages from "../../../messages/vi.json";
import enMessages from "../../../messages/en.json";

const definitions: ReplayDefinition[] = [twistfitReplay, giaPhaReplay, knowledgeBaseReplay];

describe("replay data integrity", () => {
  for (const def of definitions) {
    describe(def.id, () => {
      it("has unique sample ids and at least one sample", () => {
        const ids = def.samples.map((s) => s.id);
        expect(ids.length).toBeGreaterThan(0);
        expect(new Set(ids).size).toBe(ids.length);
      });

      for (const sample of def.samples) {
        it(`${sample.id}: every step targets an existing node`, () => {
          const nodeIds = new Set(sample.nodes.map((n) => n.id));
          for (const step of sample.steps) expect(nodeIds).toContain(step.nodeId);
        });

        it(`${sample.id}: steps are sorted by atMs and end with every node done (or skipped)`, () => {
          const times = sample.steps.map((s) => s.atMs);
          expect(times).toEqual([...times].sort((a, b) => a - b));
          const last = new Map<string, string>();
          for (const step of sample.steps) last.set(step.nodeId, step.status);
          for (const node of sample.nodes) expect(["done", "skipped"]).toContain(last.get(node.id));
          expect([...last.values()].filter((s) => s === "done").length).toBeGreaterThan(0);
        });

        it(`${sample.id}: every person's parents exist`, () => {
          if (sample.result.kind !== "people") return;
          const ids = new Set(sample.result.people.map((p) => p.id));
          expect(ids.size).toBe(sample.result.people.length);
          for (const person of sample.result.people) {
            for (const parent of person.parentIds) expect(ids).toContain(parent);
          }
        });

        it(`${sample.id}: every image exists under public/ and has alt text`, () => {
          const items = [
            ...(sample.input.kind === "images" ? sample.input.items : []),
            ...(sample.result.kind === "images" ? sample.result.items : []),
          ];
          for (const item of items) {
            expect(existsSync(path.join(process.cwd(), "public", item.src))).toBe(true);
            expect(item.alt.vi.length).toBeGreaterThan(0);
            expect(item.alt.en.length).toBeGreaterThan(0);
          }
        });
      }
    });
  }

  it("has three Twistfit samples", () => {
    expect(twistfitReplay.samples).toHaveLength(3);
  });

  const PLACEHOLDER_SVG = /\/(model|garment-[a-z-]+|result-[a-z-]+)\.svg$/;
  const ILLUSTRATIVE = { vi: "(minh hoạ)", en: "(illustrative)" } as const;

  for (const def of definitions) {
    for (const sample of def.samples) {
      const images = [
        ...(sample.input.kind === "images" ? sample.input.items : []),
        ...(sample.result.kind === "images" ? sample.result.items : []),
      ];
      // Every localized text a step shows: the text block, the duration chip, the popup heading.
      const details = sample.steps.flatMap((s) => [s.detail, s.meta, s.data?.title].filter((d) => d !== undefined));

      it(`${def.id}/${sample.id}: placeholder flag is consistent with its images and facts`, () => {
        const answers = sample.result.kind === "text" ? [sample.result.text] : [];
        const texts = [...(sample.input.kind === "question" ? [sample.input.text] : []), ...answers];
        if (sample.placeholder === true) {
          // An illustrative answer says so in both languages.
          for (const text of answers) {
            expect(text.vi).toContain(ILLUSTRATIVE.vi);
            expect(text.en).toContain(ILLUSTRATIVE.en);
          }
          for (const img of images) {
            expect(img.alt.vi.toLowerCase()).toContain("giữ chỗ");
            expect(img.alt.en.toLowerCase()).toContain("placeholder");
          }
          expect(details.some((d) => d.vi.includes(ILLUSTRATIVE.vi))).toBe(true);
          expect(details.some((d) => d.en.includes(ILLUSTRATIVE.en))).toBe(true);
        } else {
          for (const img of images) expect(img.src).not.toMatch(PLACEHOLDER_SVG);
          for (const d of [...details, ...texts]) {
            expect(d.vi).not.toContain(ILLUSTRATIVE.vi);
            expect(d.en).not.toContain(ILLUSTRATIVE.en);
          }
        }
      });
    }
  }

  it("never puts Flux parameters, prompts or per-step timings in Twistfit details", () => {
    const details = twistfitReplay.samples.flatMap((s) =>
      s.steps.flatMap((step) => (step.detail ? [step.detail.vi, step.detail.en] : [])),
    );
    expect(details.length).toBeGreaterThan(0);
    for (const text of details.map((d) => d.toLowerCase())) {
      for (const word of ["prompt", "seed", "guidance", "steps", "cfg", "ms"]) {
        expect(text).not.toMatch(new RegExp(`\\b${word}\\b`));
      }
    }
  });

  it("Gia phả is a single fictional Word-file sample with a people result", () => {
    expect(giaPhaReplay.samples).toHaveLength(1);
    const s = giaPhaReplay.samples[0];
    expect(s.input.kind).toBe("file");
    expect(s.result.kind).toBe("people");
    if (s.input.kind === "file") expect(s.input.fileName).toMatch(/\.docx$/);
  });

  it("Knowledge Base: recorded samples or exactly one placeholder asking the latest-quotation chip", () => {
    const samples = knowledgeBaseReplay.samples;
    for (const s of samples) {
      expect(s.input.kind).toBe("question");
      expect(s.result.kind).toBe("text");
      expect(s.nodes.map((n) => n.id).slice(0, 4)).toEqual(["question", "model-1", "tool-1", "db-1"]);
      expect(s.nodes.map((n) => n.id)).toContain("answer");
    }
    if (samples.some((s) => s.placeholder === true)) {
      expect(samples).toHaveLength(1);
      const [s] = samples;
      if (s.input.kind === "question") {
        expect(s.input.text).toEqual({ vi: viMessages.kb.chips.c1, en: enMessages.kb.chips.c1 });
      }
    }
  });
});
