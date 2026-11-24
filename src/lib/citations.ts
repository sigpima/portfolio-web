/**
 * Citations in a bot answer: the policy search makes the bot cite its sources as `[slug › section]`.
 * `linkCitations` turns each into a `cite:` link so the Markdown renderer can draw it as a chip;
 * `parseCitationHref` reads it back.
 */
export interface Citation {
  slug: string;
  section: string;
}

export const CITE_SCHEME = "cite:";

// slug = lowercase words joined by dashes; section = anything up to the closing bracket. Not followed by
// "(" (that would be an ordinary link already).
const CITATION = /\[([a-z0-9]+(?:-[a-z0-9]+)*) › ([^[\]\n]+)\](?!\()/g;
// Inline code and fenced blocks are never rewritten; split() with a capture group keeps them at odd indexes.
const CODE = /(```[\s\S]*?```|`[^`\n]+`)/;

/** encodeURIComponent leaves ( and ) alone, which would end a Markdown link early. */
const encode = (text: string) => encodeURIComponent(text).replace(/[()]/g, (c) => (c === "(" ? "%28" : "%29"));

export function linkCitations(markdown: string): string {
  return markdown
    .split(CODE)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(CITATION, (whole, slug: string, section: string) => {
            const trimmed = section.trim();
            if (trimmed === "") return whole;
            return `[${slug} › ${section}](${CITE_SCHEME}${encode(slug)}/${encode(trimmed)})`;
          }),
    )
    .join("");
}

export function parseCitationHref(href: string | undefined): Citation | null {
  if (href === undefined || !href.startsWith(CITE_SCHEME)) return null;
  const rest = href.slice(CITE_SCHEME.length);
  const slash = rest.indexOf("/");
  if (slash <= 0 || slash === rest.length - 1) return null;
  try {
    const slug = decodeURIComponent(rest.slice(0, slash));
    const section = decodeURIComponent(rest.slice(slash + 1));
    return slug === "" || section === "" ? null : { slug, section };
  } catch {
    return null;
  }
}
