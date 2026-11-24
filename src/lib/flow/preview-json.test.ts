import { describe, expect, it } from "vitest";
import { parsePreview } from "./preview-json";

const rows = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  project: `Biệt thự số ${i + 1}`,
  total: 1240000000 + i,
  note: i % 2 === 0 ? null : "ghi chú dài một chút để kéo dài kết quả",
  ok: i % 3 === 0,
}));
const FULL = JSON.stringify({ rows, row_count: rows.length }); // compact, like the chat service sends

describe("parsePreview", () => {
  it("parses a complete JSON preview, not partial", () => {
    expect(parsePreview('{"a":[1,2],"b":"x"}')).toEqual({ value: { a: [1, 2], b: "x" }, partial: false });
    expect(parsePreview("[]")).toEqual({ value: [], partial: false });
  });

  it("keeps plain text as text", () => {
    expect(parsePreview("total 1240000000")).toEqual({ value: "total 1240000000", partial: false });
    expect(parsePreview("")).toEqual({ value: "", partial: false });
  });

  it("formats a preview cut at 800 characters, keeping only values that were complete and saying it is partial", () => {
    const cut = FULL.slice(0, 800);
    expect(() => JSON.parse(cut)).toThrow();
    const { value, partial } = parsePreview(cut);
    expect(partial).toBe(true);
    const got = (value as { rows: unknown[] }).rows;
    expect(got.length).toBeGreaterThan(3);
    expect(got.length).toBeLessThan(rows.length);
    // Every value shown is exactly the original one (the last row may have fewer fields): nothing half-cut, no wrong number.
    got.forEach((row, i) => expect(rows[i]).toMatchObject(row as object));
    expect(value).not.toHaveProperty("row_count");
  });

  it("never shows a half-cut value, wherever the text is cut", () => {
    for (let n = 2; n < FULL.length; n += 7) {
      const { value, partial } = parsePreview(FULL.slice(0, n));
      if (typeof value === "string") continue; // nothing recoverable (cut very early)
      expect(partial, `cut at ${n}`).toBe(true);
      (value as { rows?: unknown[] }).rows?.forEach((row, i) =>
        expect(rows[i], `cut at ${n}, row ${i}`).toMatchObject(row as object),
      );
    }
  });

  it("repairs a cut inside an object, a string, a key and right after a colon", () => {
    const base = '{"a":1,"b":"hello","c":[1,2,3]}';
    for (const cut of ['{"a":1,"b":"hel', '{"a":1,"b', '{"a":1,"b":', '{"a":1,"b":"hello","c":[1,2']) {
      const { value, partial } = parsePreview(cut);
      expect(partial, cut).toBe(true);
      expect(value, cut).toMatchObject(cut.includes('"c"') ? { a: 1, b: "hello" } : { a: 1 });
      if (cut.endsWith('"hel') || cut.endsWith('"b') || cut.endsWith('"b":')) expect(value).not.toHaveProperty("b");
    }
    expect(JSON.parse(base)).toBeTruthy();
  });

  it("falls back to the raw text when nothing whole can be recovered", () => {
    expect(parsePreview('{"a')).toEqual({ value: '{"a', partial: false });
    expect(parsePreview("[ not json")).toEqual({ value: "[ not json", partial: false });
  });

  it("handles escaped quotes and brackets inside strings", () => {
    const text = JSON.stringify({ a: 'dấu "ngoặc" và ] } trong chuỗi', b: [1, 2, 3], c: "x".repeat(50) });
    const { value, partial } = parsePreview(text.slice(0, text.length - 20));
    expect(partial).toBe(true);
    expect(value).toMatchObject({ a: 'dấu "ngoặc" và ] } trong chuỗi', b: [1, 2, 3] });
  });
});
