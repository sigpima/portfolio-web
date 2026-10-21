// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { parseSse } from "./sse";
import type { ChatEvent } from "./types";

function streamOf(chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(typeof c === "string" ? enc.encode(c) : c);
      controller.close();
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>): Promise<ChatEvent[]> {
  const out: ChatEvent[] = [];
  for await (const ev of parseSse(body)) out.push(ev);
  return out;
}

describe("parseSse", () => {
  it("reassembles an event split across two chunks", async () => {
    const events = await collect(
      streamOf(['event: start\nda', 'ta: {"session_id":"abc"}\n\n']),
    );
    expect(events).toEqual([{ type: "start", session_id: "abc" }]);
  });

  it("does not break a multi-byte UTF-8 character split across chunks", async () => {
    const bytes = new TextEncoder().encode('event: answer\ndata: {"text":"Kết quả: hệ"}\n\n');
    // "ệ" is 3 bytes (E1 BB 87); split in the middle of it.
    const idx = bytes.indexOf(0xe1, bytes.indexOf(0x68 /* h */, 30));
    const events = await collect(streamOf([bytes.slice(0, idx + 1), bytes.slice(idx + 1)]));
    expect(events).toEqual([{ type: "answer", text: "Kết quả: hệ" }]);
  });

  it("parses two events in one chunk", async () => {
    const events = await collect(
      streamOf([
        'event: answer\ndata: {"text":"hi"}\n\nevent: done\ndata: {"duration_ms":12}\n\n',
      ]),
    );
    expect(events).toEqual([
      { type: "answer", text: "hi" },
      { type: "done", duration_ms: 12 },
    ]);
  });

  it("drops a trailing event without a blank line", async () => {
    const events = await collect(
      streamOf(['event: answer\ndata: {"text":"a"}\n\nevent: done\ndata: {"duration_ms":1}\n']),
    );
    expect(events).toEqual([{ type: "answer", text: "a" }]);
  });

  it("ignores unknown event types such as ping", async () => {
    const events = await collect(
      streamOf(['event: ping\ndata: {}\n\nevent: done\ndata: {"duration_ms":3}\n\n']),
    );
    expect(events).toEqual([{ type: "done", duration_ms: 3 }]);
  });

  it("handles CRLF line endings, comment lines and data: without a space", async () => {
    const events = await collect(
      streamOf([': keepalive\r\n\r\nevent: answer\r\ndata:{"text":"x"}\r\n\r\n']),
    );
    expect(events).toEqual([{ type: "answer", text: "x" }]);
  });

  it("handles a CRLF split across chunks", async () => {
    const events = await collect(streamOf(["event: answer\r", '\ndata: {"text":"x"}\r\n\r\n']));
    expect(events).toEqual([{ type: "answer", text: "x" }]);
  });

  it("handles a CRLF CRLF terminator split at every byte boundary", async () => {
    const full = 'event: answer\r\ndata: {"text":"x"}\r\n\r\nevent: done\r\ndata: {"duration_ms":1}\r\n\r\n';
    const term = full.indexOf("\r\n\r\n");
    for (let i = term; i <= term + 4; i++) {
      const events = await collect(streamOf([full.slice(0, i), full.slice(i)]));
      expect(events, `split at ${i}`).toEqual([
        { type: "answer", text: "x" },
        { type: "done", duration_ms: 1 },
      ]);
    }
  });

  it("joins a multi-line data field with newlines", async () => {
    const events = await collect(
      streamOf(['event: answer\ndata: {"text":\ndata: "a"}\n\n']),
    );
    expect(events).toEqual([{ type: "answer", text: "a" }]);
  });

  it("cancels the stream when the consumer stops early", async () => {
    const cancel = vi.fn();
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode('event: answer\ndata: {"text":"a"}\n\n'));
      },
      cancel,
    });
    for await (const ev of parseSse(body)) {
      expect(ev.type).toBe("answer");
      break;
    }
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
