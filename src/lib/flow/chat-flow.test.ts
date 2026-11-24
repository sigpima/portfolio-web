import { describe, expect, it } from "vitest";
import type { ChatEvent } from "@/lib/chat/types";
import { reduceChatFlow, initialChatFlow, type FlowEvent, type FlowLabels } from "./chat-flow";
import { applyPatch, type FlowNode, type FlowState } from "./model";

const labels: FlowLabels = {
  question: { label: "Question" },
  model: { label: "Model", sublabel: "Gemini" },
  tool: { label: "Tool" },
  database: { label: "Database" },
  answer: { label: "Answer" },
  extraCall: (n) => `Call ${n}`,
  rowCount: (n) => `${n} dòng`,
  callData: "Call data",
  resultData: "Result data",
};

function run(events: FlowEvent[], from: FlowState = initialChatFlow(labels)): FlowState {
  return events.reduce((state, event) => reduceChatFlow(state, event, labels), from);
}

function node(state: FlowState, id: string): FlowNode {
  const found = state.rows.flatMap((row) => row.nodes).find((n) => n.id === id);
  if (!found) throw new Error(`missing node ${id}`);
  return found;
}

const call = (id: number, tool = "run_sql", args: Record<string, unknown> = { q: id }): ChatEvent => ({
  type: "tool_call",
  call_id: id,
  tool,
  args,
});

const result = (id: number, over: Partial<Extract<ChatEvent, { type: "tool_result" }>> = {}): ChatEvent => ({
  type: "tool_result",
  call_id: id,
  tool: "run_sql",
  ok: true,
  duration_ms: 42,
  row_count: 7,
  sql: "SELECT 1",
  preview: "a | b",
  ...over,
});

describe("initialChatFlow", () => {
  it("builds three rows (question, call 1, answer) of idle nodes from the labels", () => {
    const state = initialChatFlow(labels);
    expect(state.rows.map((r) => r.id)).toEqual(["start", "call-1", "end"]);
    expect(state.rows.map((r) => r.nodes.map((n) => n.id))).toEqual([
      ["question"],
      ["model-1", "tool-1", "db-1"],
      ["answer"],
    ]);
    expect(state.rows.flatMap((r) => r.nodes).every((n) => n.status === "idle")).toBe(true);
    expect(state.rows.every((r) => r.title === undefined)).toBe(true);
    expect(node(state, "model-1").label).toBe("Model");
    expect(node(state, "model-1").sublabel).toBe("Gemini");
  });
});

describe("reduceChatFlow", () => {
  it("submit marks question done and model-1 active", () => {
    const state = run([{ type: "submit" }]);
    expect(node(state, "question").status).toBe("done");
    expect(node(state, "model-1").status).toBe("active");
  });

  it("tool_call finishes model-1 with a readable summary and the full call as data, activates tool-1", () => {
    const state = run([{ type: "submit" }, call(1, "run_sql", { query: "x", limit: 3 })]);
    const model = node(state, "model-1");
    expect(model.status).toBe("done");
    expect(model.detail).toBe("run_sql(query: x, limit: 3)");
    expect(model.data).toEqual({ title: "Call data", value: { tool: "run_sql", args: { query: "x", limit: 3 } } });
    expect(node(state, "tool-1").status).toBe("active");
  });

  it("truncates a very long call summary but keeps every argument in the data", () => {
    const args = { q: "x".repeat(300) };
    const model = node(run([call(1, "run_sql", args)]), "model-1");
    expect(Array.from(model.detail ?? "").length).toBeLessThanOrEqual(90);
    expect(model.detail?.endsWith("…")).toBe(true);
    expect(model.data?.value).toEqual({ tool: "run_sql", args });
  });

  it("successful tool_result completes tool and db and activates answer", () => {
    const state = run([{ type: "submit" }, call(1), result(1)]);
    expect(node(state, "tool-1").status).toBe("done");
    expect(node(state, "tool-1").detail).toContain("42");
    expect(node(state, "db-1").status).toBe("done");
    expect(node(state, "db-1").detail).toBe(labels.rowCount(7));
    expect(node(state, "db-1").data).toEqual({
      title: "Result data",
      value: { ok: true, row_count: 7, sql: "SELECT 1", preview: "a | b" },
    });
    expect(node(state, "answer").status).toBe("active");
  });

  it("parses a JSON preview into the data, and keeps a cut-off one as text", () => {
    const parsed = node(run([call(1), result(1, { preview: '[{"id":1,"name":"A"}]' })]), "db-1");
    expect((parsed.data?.value as { preview: unknown }).preview).toEqual([{ id: 1, name: "A" }]);
    const cut = node(run([call(1), result(1, { preview: '[{"id":1,"na' })]), "db-1");
    expect((cut.data?.value as { preview: unknown }).preview).toBe('[{"id":1,"na');
  });

  it("omits sql from the data and falls back to the preview line when row_count is absent", () => {
    const db = node(run([call(1), result(1, { sql: null, row_count: null })]), "db-1");
    expect(db.data?.value).toEqual({ ok: true, row_count: null, preview: "a | b" });
    expect(db.detail).toBe("a | b");
  });

  it("failed tool_result marks tool and db as error", () => {
    const state = run([{ type: "submit" }, call(1), result(1, { ok: false, preview: "boom" })]);
    expect(node(state, "tool-1").status).toBe("error");
    expect(node(state, "db-1").status).toBe("error");
  });

  it("answer without any tool call skips tool and db", () => {
    const state = run([{ type: "submit" }, { type: "answer", text: "hi" }]);
    expect(node(state, "tool-1").status).toBe("skipped");
    expect(node(state, "db-1").status).toBe("skipped");
    expect(node(state, "model-1").status).toBe("done");
    expect(node(state, "answer").status).toBe("done");
  });

  it("answer after tool calls completes the answer node and keeps tools done", () => {
    const state = run([{ type: "submit" }, call(1), result(1), { type: "answer", text: "hi" }]);
    expect(node(state, "answer").status).toBe("done");
    expect(node(state, "tool-1").status).toBe("done");
  });

  it("puts each extra call in its own row above the answer row, and titles the call rows from the second call on", () => {
    const afterFirst = run([{ type: "submit" }, call(1), result(1)]);
    expect(afterFirst.rows.every((r) => r.title === undefined)).toBe(true);
    const state = run([call(2), result(2), call(3)], afterFirst);

    expect(state.rows.map((r) => r.id)).toEqual(["start", "call-1", "call-2", "call-3", "end"]);
    expect(state.rows.map((r) => r.title)).toEqual([
      undefined,
      labels.extraCall(1),
      labels.extraCall(2),
      labels.extraCall(3),
      undefined,
    ]);
    expect(state.rows[2].nodes.map((n) => n.id)).toEqual(["model-2", "tool-2", "db-2"]);
    expect(state.rows.at(-1)?.nodes.map((n) => n.id)).toEqual(["answer"]);
    expect(node(state, "db-1").status).toBe("done");
    expect(node(state, "model-3").status).toBe("done");
    expect(node(state, "tool-3").status).toBe("active");
    expect(node(state, "db-2").status).toBe("done");
  });

  it("a following tool_call puts the answer node back to idle", () => {
    const state = run([{ type: "submit" }, call(1), result(1), call(2)]);
    expect(node(state, "answer").status).toBe("idle");
  });

  it("error turns every active node into error with the message", () => {
    const state = run([{ type: "submit" }, call(1), { type: "error", code: "model", message: "quota" }]);
    expect(node(state, "tool-1").status).toBe("error");
    expect(node(state, "tool-1").detail).toBe("quota");
    expect(node(state, "question").status).toBe("done");
    expect(node(state, "db-1").status).toBe("idle");
  });

  it("start and done do not change the diagram", () => {
    const base = run([{ type: "submit" }]);
    expect(run([{ type: "start", session_id: "s" }, { type: "done", duration_ms: 5 }], base)).toEqual(base);
  });

  it("submit after a finished or failed run resets to a fresh initial flow", () => {
    const finished = run([{ type: "submit" }, call(1), result(1), call(2), result(2), { type: "answer", text: "hi" }]);
    const failed = run([{ type: "submit" }, call(1), { type: "error", code: "internal", message: "x" }]);
    for (const previous of [finished, failed]) {
      const state = reduceChatFlow(previous, { type: "submit" }, labels);
      expect(state.rows.map((r) => r.id)).toEqual(["start", "call-1", "end"]);
      expect(state).toEqual(run([{ type: "submit" }]));
      expect(node(state, "question").status).toBe("done");
      expect(node(state, "model-1").status).toBe("active");
      expect(node(state, "tool-1").status).toBe("idle");
      expect(node(state, "answer").detail).toBeUndefined();
    }
  });

  it("never mutates the input state", () => {
    const base = initialChatFlow(labels);
    const frozen = JSON.stringify(base);
    run([{ type: "submit" }, call(1), result(1), call(2)], base);
    expect(JSON.stringify(base)).toBe(frozen);
  });
});

describe("applyPatch", () => {
  it("sets a node immutably", () => {
    const base = initialChatFlow(labels);
    const next = applyPatch(base, { type: "set", nodeId: "tool-1", status: "active", detail: "d" });
    expect(node(next, "tool-1")).toMatchObject({ status: "active", detail: "d" });
    expect(node(base, "tool-1").status).toBe("idle");
  });

  it("appends a row, or inserts it before a named row, and ignores unknown ids", () => {
    const base = initialChatFlow(labels);
    const row = { id: "r2", nodes: [] };
    expect(applyPatch(base, { type: "addRow", row }).rows.map((r) => r.id)).toEqual(["start", "call-1", "end", "r2"]);
    expect(applyPatch(base, { type: "addRow", row, before: "end" }).rows.map((r) => r.id)).toEqual([
      "start",
      "call-1",
      "r2",
      "end",
    ]);
    expect(applyPatch(base, { type: "addRow", row, before: "nope" }).rows.at(-1)?.id).toBe("r2");
    expect(applyPatch(base, { type: "set", nodeId: "nope", status: "done" })).toBe(base);
    expect(applyPatch(base, { type: "rowTitle", rowId: "nope", title: "t" })).toBe(base);
  });

  it("sets a row title and keeps a node's data when a later set has none", () => {
    const base = initialChatFlow(labels);
    const titled = applyPatch(base, { type: "rowTitle", rowId: "call-1", title: "Call 1" });
    expect(titled.rows[1].title).toBe("Call 1");
    const withData = applyPatch(titled, {
      type: "set",
      nodeId: "model-1",
      status: "done",
      data: { title: "T", value: { a: 1 } },
    });
    const later = applyPatch(withData, { type: "set", nodeId: "model-1", status: "done" });
    expect(node(later, "model-1").data).toEqual({ title: "T", value: { a: 1 } });
  });
});
