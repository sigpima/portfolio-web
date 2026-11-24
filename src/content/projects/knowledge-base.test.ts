import { describe, expect, it } from "vitest";
import vi from "../../../messages/vi.json";
import en from "../../../messages/en.json";
import questions from "../../../scripts/kb-replay-questions.json";
import { knowledgeBase } from "./knowledge-base";

const texts = (locale: "vi" | "en") =>
  [
    knowledgeBase.tagline[locale],
    knowledgeBase.summary[locale],
    knowledgeBase.approach[locale],
    ...knowledgeBase.highlights[locale],
  ].join("\n");

describe("Knowledge Base project copy (policy RAG)", () => {
  it("says it also answers from policy documents through Milvus, with 11 tools and no stale count of 10", () => {
    for (const locale of ["vi", "en"] as const) {
      const text = texts(locale);
      expect(text, locale).toMatch(/Milvus/);
      expect(text, locale).toMatch(/\b11\b/);
      expect(text, locale).not.toMatch(/\b10 (tool|read-only)/);
    }
    expect(knowledgeBase.tech).toEqual(expect.arrayContaining(["Milvus", "RAG"]));
  });

  it("gives the retrieval evaluation only with its date and sample size, and as a small sample", () => {
    for (const locale of ["vi", "en"] as const) {
      const line = knowledgeBase.highlights[locale].find((h) => /recall@5/.test(h));
      expect(line, locale).toBeDefined();
      expect(line, locale).toMatch(/2026-11-06/);
      expect(line, locale).toMatch(/28/);
      expect(line, locale).toMatch(locale === "vi" ? /mẫu nhỏ/ : /small sample/i);
      expect(line, locale).toMatch(/0[.,]65/);
    }
  });

  it("states the corpus size: 12 documents, 68 passages", () => {
    for (const locale of ["vi", "en"] as const) expect(texts(locale), locale).toMatch(/12[^\n]*68/);
  });
});

describe("Knowledge Base project copy tells the whole story, not only the quotations", () => {
  it("names policy in the title", () => {
    expect(knowledgeBase.title.vi).toMatch(/chính sách/);
    expect(knowledgeBase.title.en).toMatch(/polic/i);
    expect(knowledgeBase.title.vi).toMatch(/báo giá/);
    expect(knowledgeBase.title.en).toMatch(/quotation/i);
  });

  it("puts the RAG highlight among the first three, because the home page shows only three", () => {
    for (const locale of ["vi", "en"] as const) {
      const firstThree = knowledgeBase.highlights[locale].slice(0, 3);
      expect(firstThree.some((h) => /RAG/.test(h) && /Milvus/.test(h)), locale).toBe(true);
    }
  });

  it("states the problem for both kinds of question, figures and rules, and the one that needs both", () => {
    expect(knowledgeBase.problem.vi).toMatch(/số liệu/);
    expect(knowledgeBase.problem.vi).toMatch(/quy định|chính sách/);
    expect(knowledgeBase.problem.vi).toMatch(/cả hai/);
    expect(knowledgeBase.problem.en).toMatch(/figures/i);
    expect(knowledgeBase.problem.en).toMatch(/polic|rules/i);
    expect(knowledgeBase.problem.en).toMatch(/both/i);
  });

  it("describes the two data sources in the summary and how a policy answer is made in the approach", () => {
    for (const locale of ["vi", "en"] as const) {
      expect(knowledgeBase.summary[locale], locale).toMatch(/Postgres/);
      expect(knowledgeBase.summary[locale], locale).toMatch(/Milvus/);
      expect(knowledgeBase.approach[locale], locale).toMatch(/search_policies/);
      expect(knowledgeBase.approach[locale], locale).toMatch(/0[.,]65/);
      expect(knowledgeBase.approach[locale], locale).toMatch(locale === "vi" ? /trích nguồn/ : /cites?/);
    }
  });
});

describe("Knowledge Base demo copy", () => {
  it("offers policy suggestions, and the hints and notes mention policy", () => {
    for (const [locale, kb] of [["vi", vi.kb], ["en", en.kb]] as const) {
      expect(kb.chips.c4, locale).toBeTruthy();
      expect(kb.chips.c5, locale).toBeTruthy();
      const re = locale === "vi" ? /chính sách/i : /polic/i;
      expect(kb.emptyHint, locale).toMatch(re);
      expect(kb.placeholder, locale).toMatch(re);
      expect(kb.notes.synthetic, locale).toMatch(re);
      expect(kb.notes.synthetic, locale).toMatch(/12/);
    }
  });

  it("will record the policy questions too", () => {
    expect(questions.map((q) => q.id)).toEqual(
      expect.arrayContaining(["warranty-premium-waterproofing", "warranty-start-date"]),
    );
    for (const q of questions) {
      expect(q.question.trim()).not.toBe("");
      expect(q.title.vi.trim()).not.toBe("");
      expect(q.title.en.trim()).not.toBe("");
    }
  });
});
