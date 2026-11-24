import { describe, expect, it, vi } from "vitest";
import viMessages from "../messages/vi.json";
import questions from "./kb-replay-questions.json";
import { readFileSync } from "node:fs";
import { recordedSamples } from "../src/content/replays/knowledge-base.recorded";
import { main, OUTPUT_PATH, parseArgs, renderRecordedFile } from "./record-kb-replay";

function sse(events: [string, unknown][]): Response {
  const body = events.map(([type, data]) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`).join("");
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

const HAPPY: [string, unknown][] = [
  ["start", { session_id: "s" }],
  ["tool_call", { call_id: 1, tool: "find_quotations", args: { limit: 1 } }],
  [
    "tool_result",
    { call_id: 1, tool: "find_quotations", ok: true, duration_ms: 12, row_count: 1, sql: null, preview: "x" },
  ],
  ["answer", { text: "Câu trả lời thật." }],
  ["done", { duration_ms: 50 }],
];

function deps(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) {
  let t = 0;
  return {
    fetch: vi.fn(fetchImpl),
    now: () => (t += 10),
    writeFile: vi.fn(async () => {}),
    log: vi.fn(),
    error: vi.fn(),
  };
}

describe("kb-replay-questions.json", () => {
  it("holds the five Vietnamese suggestion chips, with unique ids and bilingual titles", () => {
    expect(questions.map((q) => q.question)).toEqual([
      viMessages.kb.chips.c1,
      viMessages.kb.chips.c2,
      viMessages.kb.chips.c3,
      viMessages.kb.chips.c4,
      viMessages.kb.chips.c5,
    ]);
    expect(new Set(questions.map((q) => q.id)).size).toBe(5);
    for (const q of questions) {
      expect(q.title.vi.length).toBeGreaterThan(0);
      expect(q.title.en.length).toBeGreaterThan(0);
    }
  });
});

describe("record-kb-replay", () => {
  it("defaults to the chat service on 127.0.0.1:8003 and accepts --url", () => {
    expect(parseArgs([])).toEqual({ url: "http://127.0.0.1:8003" });
    expect(parseArgs(["--url", "http://chat:8003/"])).toEqual({ url: "http://chat:8003" });
    expect(parseArgs(["--url=http://x:1"])).toEqual({ url: "http://x:1" });
  });

  it("records every question in a fresh conversation straight from chat and writes the samples", async () => {
    const d = deps(async (url) => (url.endsWith("/chat/status") ? Response.json({ enabled: true }) : sse(HAPPY)));
    expect(await main(["--url", "http://chat:8003"], d)).toBe(0);
    const streamCalls = d.fetch.mock.calls.filter(([url]) => url === "http://chat:8003/chat/stream");
    expect(streamCalls).toHaveLength(5);
    for (const [, init] of streamCalls) {
      expect(JSON.parse(String(init?.body))).toMatchObject({ session_id: null });
    }
    expect(d.writeFile).toHaveBeenCalledTimes(1);
    const [path, text] = d.writeFile.mock.calls[0] as unknown as [string, string];
    expect(path).toMatch(/src\/content\/replays\/knowledge-base\.recorded\.ts$/);
    expect(text).toContain("export const recordedSamples: ReplaySample[] =");
    expect(text).not.toContain("placeholder");
    expect(text).toContain("Câu trả lời thật.");
    // Vietnamese questions and answers (two per sample, five samples) are marked as such for the English UI.
    expect(text.match(/"lang": "vi"/g)).toHaveLength(10);
  });

  for (const [name, impl, message] of [
    [
      "unreachable",
      async () => {
        throw new TypeError("fetch failed");
      },
      /không với tới|unreachable/i,
    ],
    ["disabled", async () => Response.json({ enabled: false }), /tắt|disabled/i],
    [
      "an HTTP error from the stream",
      async (url: string) =>
        url.endsWith("/chat/status") ? Response.json({ enabled: true }) : Response.json({ code: "x" }, { status: 503 }),
      /503/,
    ],
    [
      "an error event",
      async (url: string) =>
        url.endsWith("/chat/status")
          ? Response.json({ enabled: true })
          : sse([
              ["start", { session_id: "s" }],
              ["error", { code: "model", message: "boom" }],
            ]),
      /model/,
    ],
  ] as const) {
    it(`exits with a clear message and writes nothing when chat is ${name}`, async () => {
      const d = deps(impl as (url: string) => Promise<Response>);
      expect(await main([], d)).toBe(1);
      expect(d.writeFile).not.toHaveBeenCalled();
      expect(d.error.mock.calls.flat().join(" ")).toMatch(message);
    });
  }

  it("renders an empty recorded file", () => {
    const text = renderRecordedFile([]);
    expect(text).toContain('import type { ReplaySample } from "./types";');
    expect(text).toContain("export const recordedSamples: ReplaySample[] = [];");
  });

  it("the committed recorded file is exactly what the script writes (never edited by hand)", () => {
    expect(readFileSync(OUTPUT_PATH, "utf8")).toBe(renderRecordedFile(recordedSamples));
    for (const sample of recordedSamples) expect(sample.placeholder).toBeUndefined();
  });
});
