/**
 * A rough plain-text reading of a Markdown answer, for the live region that screen readers
 * announce (so they do not read out asterisks, pipes and hashes). The rendered answer itself
 * is real HTML and is read normally.
 */
export function markdownToPlain(markdown: string): string {
  return markdown
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/^\s*\|?[\s:|-]{3,}\|?\s*$/gm, "") // table separator rows
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|_|`|~~)/g, "")
    .replace(/\s*\|\s*/g, ", ")
    .replace(/^,\s*|,\s*$/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
