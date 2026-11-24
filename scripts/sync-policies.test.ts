import { describe, expect, it } from "vitest";
import { buildPolicyIndex, parsePolicyFile } from "./sync-policies";

const FENCE = "```";
const FIXTURE = [
  "---",
  "slug: demo-doc",
  "title: Tài liệu mẫu",
  "doc_type: warranty",
  "applies_to:",
  "  - Một",
  "---",
  "",
  "# Tài liệu mẫu",
  "",
  "Giới thiệu.",
  "",
  "## Mục một",
  "",
  "Thân một.",
  "",
  "### Mục con",
  "",
  "Thân con.",
  "",
  "#### Mục sâu",
  "",
  "Giữ trong thân con.",
  "",
  FENCE,
  "## không phải heading",
  FENCE,
  "",
  "## Mục hai",
  "",
  "Thân hai.",
  "",
].join("\n");

describe("parsePolicyFile", () => {
  it("reads the front matter, the intro and the ## / ### sections, keeping deeper headings and fenced text in the body", () => {
    expect(parsePolicyFile(FIXTURE)).toEqual({
      slug: "demo-doc",
      title: "Tài liệu mẫu",
      docType: "warranty",
      intro: "Giới thiệu.",
      sections: [
        { heading: "Mục một", level: 2, body: "Thân một." },
        {
          heading: "Mục con",
          level: 3,
          body: ["Thân con.", "", "#### Mục sâu", "", "Giữ trong thân con.", "", FENCE, "## không phải heading", FENCE].join("\n"),
        },
        { heading: "Mục hai", level: 2, body: "Thân hai." },
      ],
    });
  });

  it("rejects a file without slug, title or a known doc_type", () => {
    expect(() => parsePolicyFile(FIXTURE.replace("slug: demo-doc\n", ""))).toThrow(/slug/);
    expect(() => parsePolicyFile(FIXTURE.replace("title: Tài liệu mẫu\n", ""))).toThrow(/title/);
    expect(() => parsePolicyFile(FIXTURE.replace("doc_type: warranty\n", ""))).toThrow(/doc_type/);
    expect(() => parsePolicyFile(FIXTURE.replace("warranty", "other"))).toThrow(/doc_type/);
    expect(() => parsePolicyFile("no front matter")).toThrow(/front matter/);
  });
});

describe("buildPolicyIndex", () => {
  it("parses every file in order of slug and rejects duplicate slugs", () => {
    const other = FIXTURE.replace("demo-doc", "a-doc");
    expect(buildPolicyIndex([FIXTURE, other]).docs.map((d) => d.slug)).toEqual(["a-doc", "demo-doc"]);
    expect(() => buildPolicyIndex([FIXTURE, FIXTURE])).toThrow(/demo-doc/);
  });
});
