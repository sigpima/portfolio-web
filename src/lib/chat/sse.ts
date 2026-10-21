import type { ChatEvent, ChatEventType } from "./types";

const KNOWN_TYPES: ReadonlySet<ChatEventType> = new Set<ChatEventType>([
  "start",
  "tool_call",
  "tool_result",
  "answer",
  "done",
  "error",
]);

function toEvent(block: string): ChatEvent | null {
  let type = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line === "" || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") type = value;
    else if (field === "data") data.push(value);
  }
  if (!KNOWN_TYPES.has(type as ChatEventType) || data.length === 0) return null;
  try {
    const payload: unknown = JSON.parse(data.join("\n"));
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return null;
    return { ...(payload as Record<string, unknown>), type } as ChatEvent;
  } catch {
    return null;
  }
}

/**
 * Parse a `text/event-stream` body into chat events. Unknown event types,
 * malformed JSON and a trailing event without its terminating blank line
 * are dropped.
 */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, "\n");
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const event = toEvent(block);
        if (event) yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
