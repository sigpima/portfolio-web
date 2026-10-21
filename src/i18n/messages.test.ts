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
});
