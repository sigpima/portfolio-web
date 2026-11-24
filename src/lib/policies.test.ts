import { describe, expect, it } from "vitest";
import { POLICY_SLUGS } from "@/content/policies/slugs";
import { findPolicyTarget, loadPolicies, type PolicyIndex } from "./policies";

const index: PolicyIndex = {
  docs: [
    {
      slug: "doc-mot",
      title: "Chính sách mẫu",
      docType: "warranty",
      intro: "",
      sections: [
        { heading: "Giữ lại bảo hành", level: 2, body: "a" },
        { heading: "Thời hạn: tiêu chuẩn", level: 2, body: "b" },
        { heading: "Mục con", level: 3, body: "c" },
      ],
    },
  ],
};
const target = (slug: string, section: string) => findPolicyTarget(index, { slug, section });

describe("findPolicyTarget", () => {
  it("finds a section by its exact heading", () => {
    expect(target("doc-mot", "Giữ lại bảo hành")?.sectionIndex).toBe(0);
  });

  it("finds it from the full path the policy search reports, with the document title in front", () => {
    expect(target("doc-mot", "Chính sách mẫu › Giữ lại bảo hành")?.sectionIndex).toBe(0);
    expect(target("doc-mot", "Chính sách mẫu › Thời hạn: tiêu chuẩn › Mục con")?.sectionIndex).toBe(2);
  });

  it("ignores case, extra spaces and a trailing colon or full stop", () => {
    expect(target("doc-mot", "  giữ   LẠI bảo hành. ")?.sectionIndex).toBe(0);
    expect(target("doc-mot", "Thời hạn tiêu chuẩn")?.sectionIndex).toBeNull();
    expect(target("doc-mot", "thời hạn: tiêu chuẩn:")?.sectionIndex).toBe(1);
  });

  it("falls back to an earlier path segment when the last one is not a heading", () => {
    expect(target("doc-mot", "Giữ lại bảo hành › Một đoạn lạ")?.sectionIndex).toBe(0);
  });

  it("opens the document without a section when no heading matches, and gives null for an unknown slug", () => {
    expect(target("doc-mot", "Không có mục này")).toEqual({ doc: index.docs[0], sectionIndex: null });
    expect(target("khong-co", "Giữ lại bảo hành")).toBeNull();
  });
});

describe("the bundled policy documents", () => {
  it("holds the 12 documents of knowledge_base, each with sections and a known type", async () => {
    const { docs } = await loadPolicies();
    expect(docs).toHaveLength(12);
    for (const doc of docs) {
      expect(["technical", "warranty"]).toContain(doc.docType);
      expect(doc.sections.length, doc.slug).toBeGreaterThan(0);
      expect(doc.title.trim(), doc.slug).not.toBe("");
    }
    expect(new Set(docs.map((d) => d.slug)).size).toBe(12);
  });

  it("lists exactly those slugs in POLICY_SLUGS", async () => {
    const { docs } = await loadPolicies();
    expect([...POLICY_SLUGS].sort()).toEqual(docs.map((d) => d.slug).sort());
  });

  it("finds the section the policy search reports for the warranty retention question", async () => {
    const found = findPolicyTarget(await loadPolicies(), {
      slug: "chinh-sach-bao-hanh",
      section: "Chính sách bảo hành công trình sơn › Giữ lại bảo hành",
    });
    expect(found?.doc.sections[found!.sectionIndex!].heading).toBe("Giữ lại bảo hành");
  });
});
