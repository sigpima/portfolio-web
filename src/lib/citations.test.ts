import { describe, expect, it } from "vitest";
import { linkCitations, parseCitationHref } from "./citations";

const hrefOf = (markdown: string) => /\]\((cite:[^)]*)\)/.exec(linkCitations(markdown))?.[1];

describe("linkCitations", () => {
  it("turns [slug › section] into a cite: link that parses back, whatever the characters in the section", () => {
    for (const section of ["Giữ lại bảo hành", "Chính sách › Giữ lại", "Thời hạn & điều kiện (24 tháng)", "A/B"]) {
      const href = hrefOf(`Xem [chinh-sach-bao-hanh › ${section}].`);
      expect(parseCitationHref(href)).toEqual({ slug: "chinh-sach-bao-hanh", section });
    }
  });

  it("keeps the visible text exactly as the bot wrote it", () => {
    expect(linkCitations("[xu-ly-be-mat › Mục 1]")).toMatch(/^\[xu-ly-be-mat › Mục 1\]\(cite:/);
  });

  it("links every citation in a line", () => {
    const out = linkCitations("A [a-b › Một] và B [c-d › Hai].");
    expect(out.match(/\(cite:/g)).toHaveLength(2);
  });

  it("leaves ordinary links, plain brackets and non-citations alone", () => {
    for (const text of [
      "[a-b › c](https://x.y)",
      "[Không phải trích dẫn]",
      "[Slug-Hoa › X]",
      "[a-b ›]",
      "[a-b › ]",
    ]) {
      expect(linkCitations(text)).toBe(text);
    }
  });

  it("leaves citations inside inline code and fenced code alone", () => {
    expect(linkCitations("`[a-b › c]`")).toBe("`[a-b › c]`");
    const fenced = "```\n[a-b › c]\n```";
    expect(linkCitations(fenced)).toBe(fenced);
    expect(linkCitations("`x` rồi [a-b › c]")).toMatch(/\(cite:/);
  });
});

describe("parseCitationHref", () => {
  it("is null for anything that is not a well-formed cite: link", () => {
    for (const href of [undefined, "", "https://x", "cite:", "cite:slug", "cite:/section", "cite:%E0%A4%A/x"]) {
      expect(parseCitationHref(href)).toBeNull();
    }
  });
});
