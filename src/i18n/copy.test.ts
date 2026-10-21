import { describe, expect, it } from "vitest";
import vi from "../../messages/vi.json";
import en from "../../messages/en.json";

function strings(obj: Record<string, unknown>, prefix = ""): [string, string][] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") return [[path, value] as [string, string]];
    return value && typeof value === "object" ? strings(value as Record<string, unknown>, path) : [];
  });
}

const BOTH = [
  { name: "vi", messages: vi, flat: strings(vi) },
  { name: "en", messages: en, flat: strings(en) },
];

/*
 * The live demo is only live with an owner's invite link, so no copy may promise it to
 * every visitor, and the bare "Chạy thật"/"Live" label may appear only where it is a
 * legend entry or inside the (live) demo itself.
 */
const LABEL = { vi: /Chạy thật/, en: /\bLive\b/ } as const;
const ALLOWED_LABEL_KEYS = new Set(["demo.badge.live.label", "demo.badge.liveInvite.label"]);

describe("honest copy about live demos and logging", () => {
  for (const { name, flat } of BOTH) {
    const lang = name as "vi" | "en";

    it(`(${lang}) no string says the demo runs live for everyone, every time`, () => {
      expect(flat.filter(([, v]) => /mỗi khi bạn dùng|every time you use/i.test(v))).toEqual([]);
    });

    it(`(${lang}) a string that says "Chạy thật"/"Live" as a label is only an allowed key`, () => {
      const offenders = flat
        .filter(([, v]) => LABEL[lang].test(v))
        .map(([k]) => k)
        .filter((k) => !ALLOWED_LABEL_KEYS.has(k) && !k.startsWith("kb."));
      // Prose that talks ABOUT live demos (meta, hero lead...) is fine, but it must not be a
      // bare label: only these keys may contain the word at all.
      expect(offenders).toEqual([]);
    });
  }

  it("the allowed label keys really are where the labels live (the check is not vacuous)", () => {
    expect(vi.demo.badge.live.label).toBe("Chạy thật");
    expect(en.demo.badge.live.label).toBe("Live");
    for (const { flat } of BOTH) {
      const keys = flat.filter(([, v]) => /Chạy thật|\bLive\b/.test(v)).map(([k]) => k);
      expect(keys).toEqual(expect.arrayContaining([...ALLOWED_LABEL_KEYS]));
    }
  });

  it("the live badge description names the invite link", () => {
    expect(vi.demo.badge.live.description).toMatch(/link mời/);
    expect(en.demo.badge.live.description).toMatch(/invite link/);
  });

  it("the live KB privacy note says questions are not stored AND that the link's feature use is logged", () => {
    expect(vi.kb.notes.privacy).toContain("Câu hỏi của bạn không được lưu.");
    expect(vi.kb.notes.privacy).toContain(
      "Hệ thống chỉ ghi lại rằng link mời của bạn đã dùng tính năng nào và lúc nào.",
    );
    expect(en.kb.notes.privacy).toContain("Your questions are not stored.");
    expect(en.kb.notes.privacy).toContain(
      "The system only records which feature your invite link used, and when.",
    );
  });
});
