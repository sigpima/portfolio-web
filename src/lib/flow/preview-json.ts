/**
 * The chat service cuts every result preview at 800 characters, so a long JSON result arrives
 * cut off in the middle and `JSON.parse` fails. `parsePreview` still gives something formatted:
 * the longest prefix made only of values that were complete, with the open brackets closed,
 * flagged `partial`. Nothing half-cut is ever shown (a number cut at "12" could have been
 * "1240000000"), so a trailing incomplete value is dropped, not repaired.
 */
export interface ParsedPreview {
  /** The parsed JSON, or the raw text when it is not JSON or nothing whole can be recovered. */
  value: unknown;
  /** True when the preview was cut off and `value` holds only its complete beginning. */
  partial: boolean;
}

const closers = (stack: string[]) =>
  stack
    .slice()
    .reverse()
    .map((open) => (open === "{" ? "}" : "]"))
    .join("");

function tryParse(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

function recoverPrefix(text: string): { value: unknown } | undefined {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  // The text up to the last comma outside any string, with the brackets open at that point closed:
  // everything before a comma is a complete value.
  let upToLastComma: string | undefined;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
    else if (ch === ",") upToLastComma = text.slice(0, i) + closers(stack);
  }
  // If the cut fell right after a finished value (a closing bracket or quote), keep all of it.
  const last = text.at(-1);
  if (!inString && (last === "}" || last === "]" || last === '"')) {
    const whole = tryParse(text + closers(stack));
    if (whole.ok) return { value: whole.value };
  }
  if (upToLastComma !== undefined) {
    const prefix = tryParse(upToLastComma);
    if (prefix.ok) return { value: prefix.value };
  }
  return undefined;
}

export function parsePreview(preview: string): ParsedPreview {
  const text = preview.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) return { value: preview, partial: false };
  const whole = tryParse(text);
  if (whole.ok) return { value: whole.value, partial: false };
  const recovered = recoverPrefix(text);
  return recovered ? { value: recovered.value, partial: true } : { value: preview, partial: false };
}
