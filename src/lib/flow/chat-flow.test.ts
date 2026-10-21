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
  it("builds row r1 with five idle nodes from the labels", () => {
    const state = initialChatFlow(labels);
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].id).toBe("r1");
    expect(state.rows[0].nodes.map((n) => n.id)).toEqual(["question", "model-1", "tool-1", "db-1", "answer"]);
    expect(state.rows[0].nodes.every((n) => n.status === "idle")).toBe(true);
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

  it("tool_call finishes model-1 with tool name and args, activates tool-1", () => {
    const state = run([{ type: "submit" }, call(1, "run_sql", { query: "x" })]);
    const model = node(state, "model-1");
    expect(model.status).toBe("done");
    expect(model.detail).toContain("run_sql");
    expect(model.detail).toContain(JSON.stringify({ query: "x" }));
    expect(node(state, "tool-1").status).toBe("active");
  });

  it("successful tool_result completes tool and db and activates answer", () => {
    const state = run([{ type: "submit" }, call(1), result(1)]);
    expect(node(state, "tool-1").status).toBe("done");
    expect(node(state, "tool-1").detail).toContain("42");
    expect(node(state, "db-1").status).toBe("done");
    expect(node(state, "db-1").detail).toContain("7");
    expect(node(state, "db-1").detail).toContain("SELECT 1");
    expect(node(state, "answer").status).toBe("active");
  });

  it("omits sql and row_count from db detail when absent", () => {
    const state = run([call(1), result(1, { sql: null, row_count: null })]);
    const detail = node(state, "db-1").detail ?? "";
    expect(detail).not.toContain("SELECT");
    expect(detail).toContain("a | b");
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

  it("adds rows r2 and r3 for extra calls without touching earlier rows", () => {
    const afterFirst = run([{ type: "submit" }, call(1), result(1)]);
    const r1Before = afterFirst.rows[0];
    const state = run([call(2), result(2), call(3)], afterFirst);

    expect(state.rows.map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
    expect(state.rows[1].title).toBe(labels.extraCall(2));
    expect(state.rows[2].title).toBe(labels.extraCall(3));
    expect(state.rows[1].nodes.map((n) => n.id)).toEqual(["model-2", "tool-2", "db-2"]);
    expect(state.rows[0].nodes.map((n) => n.status)).toEqual(
      r1Before.nodes.map((n) => (n.id === "answer" ? "idle" : n.status)),
    );
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

  it("appends a row and ignores unknown node ids", () => {
    const base = initialChatFlow(labels);
    const row = { id: "r2", nodes: [] };
    expect(applyPatch(base, { type: "addRow", row }).rows).toHaveLength(2);
    expect(applyPatch(base, { type: "set", nodeId: "nope", status: "done" })).toBe(base);
  });
});
