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

function valueAt(obj: Record<string, unknown>, path: string): string {
  return path.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], obj) as string;
}

/** Top-level ICU argument names of a message, e.g. `{count}` or `{seconds, plural, ...}`. */
function placeholders(text: string): string[] {
  const names = new Set<string>();
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) {
        const match = /^\{\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(text.slice(i));
        if (match) names.add(match[1]);
      }
      depth++;
    } else if (text[i] === "}") {
      depth--;
    }
  }
  return [...names].sort();
}

/** True when a text says where something runs or is kept (place, host type, region). */
function claimsLocation(text: string): boolean {
  return (
    /máy chủ|server|cloud|đám mây|cục bộ|\blocal(ly)?\b|Việt Nam|Vietnam|Mỹ|châu Âu|Europe|Đức|German/i.test(text) ||
    /\bUS\b|U\.S\.|\bEU\b/.test(text)
  );
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

  it("has the same ICU placeholders in vi and en for twistfit.live", () => {
    const live = (messages: unknown) =>
      (messages as { twistfit: { live: Record<string, unknown> } }).twistfit.live;
    const viLive = live(vi);
    const enLive = live(en);
    for (const key of flatten(viLive)) {
      const viText = valueAt(viLive, key);
      const enText = valueAt(enLive, key);
      expect(placeholders(enText), key).toEqual(placeholders(viText));
    }
  });

  it("keeps the twistfit honesty notes silent about where Flux runs or images are kept", () => {
    for (const messages of [vi, en]) {
      const notes = Object.values(
        (messages as { twistfit: { live: { notes: Record<string, string> } } }).twistfit.live.notes,
      ).join(" ");
      expect(notes).toMatch(/Black Forest Labs/);
      expect(claimsLocation(notes)).toBe(false);
    }
  });

  it("flags location claims but not ordinary English", () => {
    for (const claim of [
      "Flux chạy trên máy chủ riêng.",
      "Runs on our own server.",
      "Hosted in the cloud.",
      "Runs locally on a local GPU.",
      "Ảnh được xử lý tại Việt Nam.",
      "Processed in the US.",
      "Hosted in the EU.",
      "Runs in Europe.",
    ]) {
      expect(claimsLocation(claim), claim).toBe(true);
    }
    for (const fine of [
      "This lets us show the result.",
      "We use your picks to make the image.",
      "The result image is kept for up to an hour so you can download it, then deleted.",
    ]) {
      expect(claimsLocation(fine), fine).toBe(false);
    }
  });

  it("uses a neutral sublabel for the answer node (the bot may not cite figures)", () => {
    expect(vi.kb.nodes.answer.sublabel).not.toMatch(/số liệu/);
    expect(en.kb.nodes.answer.sublabel).not.toMatch(/figure/i);
  });
});
