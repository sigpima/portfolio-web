import { describe, expect, it } from "vitest";
import type { ChatEvent } from "@/lib/chat/types";
import viMessages from "../../../messages/vi.json";
import enMessages from "../../../messages/en.json";
import { buildReplaySample, type TimedChatEvent } from "./from-chat-events";
import { replayFlowAt } from "./use-replay";
import { placeholderSample } from "@/content/replays/knowledge-base";

const ANSWER = "Báo giá mới nhất là BG-2026-031, tổng 1.240.000.000 đ.";
const options = {
  id: "latest",
  title: { vi: "Báo giá mới nhất", en: "Latest quotation" },
  question: { vi: "Báo giá mới nhất có giá bao nhiêu?", en: "Báo giá mới nhất có giá bao nhiêu?" },
};

function timed(pairs: [number, ChatEvent][]): TimedChatEvent[] {
  return pairs.map(([atMs, event]) => ({ atMs, event }));
}

const happy = timed([
  [310, { type: "start", session_id: "s-1" }],
  [1450, { type: "tool_call", call_id: 1, tool: "find_quotations", args: { order_by: "issue_date_desc", limit: 1 } }],
  [
    1530,
    {
      type: "tool_result",
      call_id: 1,
      tool: "find_quotations",
      ok: true,
      duration_ms: 64,
      row_count: 1,
      sql: null,
      preview: "BG-2026-031 1240000000",
    },
  ],
  [3920, { type: "answer", text: ANSWER }],
  [3925, { type: "done", duration_ms: 3900 }],
]);

function lastStatus(sample: ReturnType<typeof buildReplaySample>) {
  const last = new Map<string, string>();
  for (const step of sample.steps) last.set(step.nodeId, step.status);
  return last;
}

describe("buildReplaySample", () => {
  it("uses the chat flow node ids and the kb.nodes labels in both languages", () => {
    const sample = buildReplaySample(happy, options);
    expect(sample.nodes.map((n) => n.id)).toEqual(["question", "model-1", "tool-1", "db-1", "answer"]);
    const model = sample.nodes.find((n) => n.id === "model-1")!;
    expect(model.label).toEqual({ vi: viMessages.kb.nodes.model.label, en: enMessages.kb.nodes.model.label });
    expect(model.sublabel).toEqual({
      vi: viMessages.kb.nodes.model.sublabel,
      en: enMessages.kb.nodes.model.sublabel,
    });
  });

  it("emits steps in time order with the real event times, ending with every node done", () => {
    const sample = buildReplaySample(happy, options);
    const times = sample.steps.map((s) => s.atMs);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times[0]).toBe(0);
    // Steps happen exactly at the recorded event times.
    expect(new Set(times)).toEqual(new Set([0, 1450, 1530, 3920]));
    expect(sample.steps.find((s) => s.nodeId === "tool-1" && s.status === "active")?.atMs).toBe(1450);
    expect(sample.steps.find((s) => s.nodeId === "answer" && s.status === "done")?.atMs).toBe(3920);
    const last = lastStatus(sample);
    for (const node of sample.nodes) expect(last.get(node.id), node.id).toBe("done");
  });

  it("carries localized details (vi and en) and replays to the live diagram's final state", () => {
    const sample = buildReplaySample(happy, options);
    const db = sample.steps.filter((s) => s.nodeId === "db-1" && s.detail).at(-1)!;
    expect(db.detail!.vi).toContain("1 dòng");
    expect(db.detail!.en).toContain("1 row");
    expect(db.detail!.vi).toContain("BG-2026-031");
    const model = sample.steps.find((s) => s.nodeId === "model-1" && s.detail)!;
    expect(model.detail).toEqual({
      vi: 'find_quotations {"order_by":"issue_date_desc","limit":1}',
      en: 'find_quotations {"order_by":"issue_date_desc","limit":1}',
    });
    const final = replayFlowAt(sample, "en", sample.steps.length);
    expect(final.rows[0].nodes.find((n) => n.id === "tool-1")?.detail).toBe("64 ms");
  });

  it("sets the question input and the answer text result, and never marks itself a placeholder", () => {
    const sample = buildReplaySample(happy, options);
    expect(sample.id).toBe("latest");
    expect(sample.title).toEqual(options.title);
    expect(sample.input).toEqual({ kind: "question", text: options.question });
    expect(sample.result).toEqual({ kind: "text", text: { vi: ANSWER, en: ANSWER } });
    expect("placeholder" in sample).toBe(false);
  });

  it("passes an explicit language to the question and the answer, and none by default", () => {
    const marked = buildReplaySample(happy, { ...options, lang: "vi" });
    expect(marked.input).toMatchObject({ kind: "question", lang: "vi" });
    expect(marked.result).toMatchObject({ kind: "text", lang: "vi" });
    const plain = buildReplaySample(happy, options);
    expect("lang" in plain.input).toBe(false);
    expect("lang" in plain.result).toBe(false);
  });

  it("marks the running node as error on an error event, with our own localized text", () => {
    const sample = buildReplaySample(
      timed([
        [200, { type: "start", session_id: "s-1" }],
        [900, { type: "error", code: "model", message: "upstream said something" }],
      ]),
      options,
    );
    const err = sample.steps.find((s) => s.status === "error");
    expect(err).toMatchObject({ atMs: 900, nodeId: "model-1" });
    expect(err!.detail).toEqual({ vi: viMessages.kb.errors.model, en: enMessages.kb.errors.model });
    expect(lastStatus(sample).get("model-1")).toBe("error");
    expect(JSON.stringify(sample)).not.toContain("upstream said something");
  });

  it("puts extra tool calls on their own titled row", () => {
    const sample = buildReplaySample(
      timed([
        [0, { type: "start", session_id: "s" }],
        [100, { type: "tool_call", call_id: 1, tool: "a", args: {} }],
        [200, { type: "tool_result", call_id: 1, tool: "a", ok: true, duration_ms: 5, row_count: 2, sql: null, preview: "" }],
        [300, { type: "tool_call", call_id: 2, tool: "b", args: {} }],
        [400, { type: "tool_result", call_id: 2, tool: "b", ok: true, duration_ms: 6, row_count: 1, sql: null, preview: "" }],
        [500, { type: "answer", text: "ok" }],
        [510, { type: "done", duration_ms: 500 }],
      ]),
      options,
    );
    const model2 = sample.nodes.find((n) => n.id === "model-2")!;
    expect(model2.row).toEqual({ id: "r2", title: { vi: "Lần gọi tool 2", en: "Tool call 2" } });
    const flow = replayFlowAt(sample, "vi", sample.steps.length);
    expect(flow.rows.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(flow.rows[1].title).toBe("Lần gọi tool 2");
    expect(flow.rows[0].nodes.map((n) => n.id)).toEqual(["question", "model-1", "tool-1", "db-1", "answer"]);
    for (const node of sample.nodes) expect(lastStatus(sample).get(node.id), node.id).toBe("done");
  });

  it("the Knowledge Base placeholder sample uses the same nodes and labels as a recorded one", () => {
    expect(placeholderSample.nodes).toEqual(buildReplaySample(happy, options).nodes);
  });
});
