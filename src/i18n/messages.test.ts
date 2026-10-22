import { describe, expect, it } from "vitest";
import vi from "../../messages/vi.json";
import en from "../../messages/en.json";

function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object"
      ? flatten(value as Record<string, unknown>, path)
      : [path];
  });
}

describe("messages", () => {
  it("vi.json and en.json have identical flattened key sets", () => {
    expect(flatten(vi).sort()).toEqual(flatten(en).sort());
  });

  it("has no empty strings", () => {
    for (const messages of [vi, en]) {
      const empty = flatten(messages).filter((k) => {
        const value = k
          .split(".")
          .reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], messages);
        return value === "";
      });
      expect(empty).toEqual([]);
    }
  });

  it("has three suggested KB questions that name no placeholder projects", () => {
    for (const messages of [vi, en]) {
      const chips = (messages as { kb: { chips: Record<string, string> } }).kb.chips;
      expect(Object.keys(chips).sort()).toEqual(["c1", "c2", "c3"]);
      for (const text of Object.values(chips)) {
        expect(text.trim().length).toBeGreaterThan(10);
        expect(text).not.toMatch(/project [AB]\b|công trình [AB]\b/i);
      }
    }
  });

  it("has the same twistfit.live keys in vi and en", () => {
    const viLive = (vi as { twistfit?: { live?: Record<string, unknown> } }).twistfit?.live;
    const enLive = (en as { twistfit?: { live?: Record<string, unknown> } }).twistfit?.live;
    expect(viLive).toBeDefined();
    expect(enLive).toBeDefined();
    expect(flatten(viLive!).sort()).toEqual(flatten(enLive!).sort());
  });

  it("keeps the twistfit honesty notes silent about where Flux runs", () => {
    for (const messages of [vi, en]) {
      const notes = Object.values(
        (messages as { twistfit: { live: { notes: Record<string, string> } } }).twistfit.live.notes,
      ).join(" ");
      expect(notes).toMatch(/Black Forest Labs/);
      expect(notes).not.toMatch(/máy chủ|server|cloud|đám mây|cục bộ|local|Việt Nam|Vietnam|Mỹ|\bUS\b|EU|châu Âu|Europe|Đức|German/i);
    }
  });

  it("uses a neutral sublabel for the answer node (the bot may not cite figures)", () => {
    expect(vi.kb.nodes.answer.sublabel).not.toMatch(/số liệu/);
    expect(en.kb.nodes.answer.sublabel).not.toMatch(/figure/i);
  });
});
