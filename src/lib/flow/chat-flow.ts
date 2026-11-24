import type { ChatEvent } from "@/lib/chat/types";
import { applyPatch, type FlowNode, type FlowPatch, type FlowRow, type FlowState } from "./model";

export type FlowEvent = ChatEvent | { type: "submit" };

interface NodeLabel {
  label: string;
  sublabel?: string;
}

export interface FlowLabels {
  question: NodeLabel;
  model: NodeLabel;
  tool: NodeLabel;
  database: NodeLabel;
  answer: NodeLabel;
  /** Title of the row of tool call `n`; shown only once there is more than one call. */
  extraCall: (n: number) => string;
  rowCount: (n: number) => string;
  /** Popup headings for the structured details. */
  callData: string;
  resultData: string;
}

/** Row ids: the question first, one row per tool call, the answer last. */
export const START_ROW = "start";
export const END_ROW = "end";
export const callRowId = (n: number) => `call-${n}`;

/** Longest one-line summary shown inside a node. The full value is one click away. */
const SUMMARY_MAX_CHARS = 90;

function makeNode(id: string, text: NodeLabel): FlowNode {
  return { id, label: text.label, sublabel: text.sublabel, status: "idle" };
}

function callNodes(n: number, labels: FlowLabels): FlowNode[] {
  return [
    makeNode(`model-${n}`, labels.model),
    makeNode(`tool-${n}`, labels.tool),
    makeNode(`db-${n}`, labels.database),
  ];
}

export function initialChatFlow(labels: FlowLabels): FlowState {
  return {
    rows: [
      { id: START_ROW, nodes: [makeNode("question", labels.question)] },
      { id: callRowId(1), nodes: callNodes(1, labels) },
      { id: END_ROW, nodes: [makeNode("answer", labels.answer)] },
    ],
  };
}

function patchAll(state: FlowState, patches: FlowPatch[]): FlowState {
  return patches.reduce(applyPatch, state);
}

/**
 * Makes sure the row for call `n` exists (call 1 always does). A new call row goes
 * above the answer row; from the second call on every call row is titled.
 */
function ensureCallRow(state: FlowState, n: number, labels: FlowLabels): FlowState {
  const id = callRowId(n);
  if (n <= 1 || state.rows.some((row) => row.id === id)) return state;
  const row: FlowRow = { id, nodes: callNodes(n, labels) };
  let next = applyPatch(state, { type: "addRow", row, before: END_ROW });
  for (const r of next.rows) {
    const m = /^call-(\d+)$/.exec(r.id);
    if (m) next = applyPatch(next, { type: "rowTitle", rowId: r.id, title: labels.extraCall(Number(m[1])) });
  }
  return next;
}

function statusOf(state: FlowState, nodeId: string): FlowNode["status"] | undefined {
  for (const row of state.rows) {
    const found = row.nodes.find((n) => n.id === nodeId);
    if (found) return found.status;
  }
  return undefined;
}

function truncate(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : text;
}

/** `tool(key: value, ...)`: readable at a glance, without braces or quotes. */
export function callSummary(tool: string, args: Record<string, unknown>): string {
  const parts = Object.entries(args ?? {}).map(
    ([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`,
  );
  return truncate(`${tool}(${parts.join(", ")})`, SUMMARY_MAX_CHARS);
}

/** The preview as a value: parsed when it is JSON (it may be cut off, then it stays text). */
function parsePreview(preview: string): unknown {
  const text = preview.trim();
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return preview;
    }
  }
  return preview;
}

function resultSummary(event: Extract<ChatEvent, { type: "tool_result" }>, labels: FlowLabels): string | undefined {
  if (event.ok && event.row_count !== null) return labels.rowCount(event.row_count);
  const firstLine = event.preview.split("\n", 1)[0]?.trim() ?? "";
  return firstLine === "" ? undefined : truncate(firstLine, SUMMARY_MAX_CHARS);
}

function resultValue(event: Extract<ChatEvent, { type: "tool_result" }>): Record<string, unknown> {
  const value: Record<string, unknown> = { ok: event.ok, row_count: event.row_count };
  if (event.sql !== null && event.sql !== "") value.sql = event.sql;
  if (event.preview !== "") value.preview = parsePreview(event.preview);
  return value;
}

/**
 * Pure reducer: folds one event into the diagram, showing only what actually happened.
 * Call ids are assumed sequential starting at 1 (backend contract).
 */
export function reduceChatFlow(state: FlowState, event: FlowEvent, labels: FlowLabels): FlowState {
  switch (event.type) {
    case "submit":
      // A new question starts a fresh diagram.
      return patchAll(initialChatFlow(labels), [
        { type: "set", nodeId: "question", status: "done" },
        { type: "set", nodeId: "model-1", status: "active" },
      ]);

    case "tool_call": {
      const n = event.call_id;
      if (!Number.isInteger(n) || n < 1) return state;
      return patchAll(ensureCallRow(state, n, labels), [
        {
          type: "set",
          nodeId: `model-${n}`,
          status: "done",
          detail: callSummary(event.tool, event.args),
          data: { title: labels.callData, value: { tool: event.tool, args: event.args } },
        },
        { type: "set", nodeId: `tool-${n}`, status: "active" },
        { type: "set", nodeId: "answer", status: "idle" },
      ]);
    }

    case "tool_result": {
      const n = event.call_id;
      if (!Number.isInteger(n) || n < 1) return state;
      const status = event.ok ? "done" : "error";
      return patchAll(ensureCallRow(state, n, labels), [
        { type: "set", nodeId: `tool-${n}`, status, detail: `${event.duration_ms} ms` },
        {
          type: "set",
          nodeId: `db-${n}`,
          status,
          detail: resultSummary(event, labels),
          data: { title: labels.resultData, value: resultValue(event) },
        },
        { type: "set", nodeId: "answer", status: "active" },
      ]);
    }

    case "answer": {
      const noToolCalled = statusOf(state, "tool-1") === "idle";
      const patches: FlowPatch[] = [{ type: "set", nodeId: "model-1", status: "done" }];
      if (noToolCalled) {
        patches.push(
          { type: "set", nodeId: "tool-1", status: "skipped" },
          { type: "set", nodeId: "db-1", status: "skipped" },
        );
      }
      patches.push({ type: "set", nodeId: "answer", status: "done" });
      return patchAll(state, patches);
    }

    case "error": {
      const patches: FlowPatch[] = state.rows.flatMap((row) =>
        row.nodes
          .filter((node) => node.status === "active")
          .map((node): FlowPatch => ({ type: "set", nodeId: node.id, status: "error", detail: event.message })),
      );
      return patchAll(state, patches);
    }

    case "start":
    case "done":
      return state;
  }
}
