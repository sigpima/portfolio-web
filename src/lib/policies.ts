import type { Citation } from "@/lib/citations";
import { POLICY_SLUGS } from "@/content/policies/slugs";

/** One synthetic policy document of knowledge_base, split at its ## / ### headings. */
export interface PolicyDoc {
  slug: string;
  title: string;
  docType: "technical" | "warranty";
  /** Markdown between the front matter and the first ## heading, without the # title. */
  intro: string;
  sections: { heading: string; level: 2 | 3; body: string }[];
}

export interface PolicyIndex {
  docs: PolicyDoc[];
}

/** Whether a citation names a document of the bundle (the only ones a chip can open). */
export const isPolicyCitation = (citation: Citation): boolean => POLICY_SLUGS.includes(citation.slug);

let cached: Promise<PolicyIndex> | undefined;

/** The bundled documents (about 70 KB), fetched on first use so they stay out of the page's own script. */
export function loadPolicies(): Promise<PolicyIndex> {
  cached ??= import("@/content/policies/policies.generated.json").then((m) => m.default as PolicyIndex);
  return cached;
}

function normalize(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.:;,\s]+$/, "")
    .trim();
}

/**
 * Finds what a citation points at. `section` is the path the policy search reports
 * (`<title> › <##> › <###>`, or just a heading when the bot shortened it); the last segment that
 * names a heading of the document wins. An unknown slug gives null; a known slug whose section
 * matches no heading still opens the document (`sectionIndex` null).
 */
export function findPolicyTarget(
  index: PolicyIndex,
  citation: Citation,
): { doc: PolicyDoc; sectionIndex: number | null } | null {
  const doc = index.docs.find((d) => d.slug === citation.slug);
  if (!doc) return null;
  const title = normalize(doc.title);
  const headings = doc.sections.map((s) => normalize(s.heading));
  const segments = citation.section.split("›").map(normalize).filter((s) => s !== "" && s !== title);
  for (let i = segments.length - 1; i >= 0; i--) {
    const at = headings.indexOf(segments[i]);
    if (at !== -1) return { doc, sectionIndex: at };
  }
  return { doc, sectionIndex: null };
}
