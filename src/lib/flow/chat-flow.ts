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
  extraCall: (n: number) => string;
}

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
      {
        id: "r1",
        nodes: [
          makeNode("question", labels.question),
          ...callNodes(1, labels),
          makeNode("answer", labels.answer),
        ],
      },
    ],
  };
}

function patchAll(state: FlowState, patches: FlowPatch[]): FlowState {
  return patches.reduce(applyPatch, state);
}

/** Makes sure the row for call `n` exists (r1 always does); extra calls get their own titled row. */
function ensureCallRow(state: FlowState, n: number, labels: FlowLabels): FlowState {
  const id = `r${n}`;
  if (n <= 1 || state.rows.some((row) => row.id === id)) return state;
  const row: FlowRow = { id, title: labels.extraCall(n), nodes: callNodes(n, labels) };
  return applyPatch(state, { type: "addRow", row });
}

function statusOf(state: FlowState, nodeId: string): FlowNode["status"] | undefined {
  for (const row of state.rows) {
    const found = row.nodes.find((n) => n.id === nodeId);
    if (found) return found.status;
  }
  return undefined;
}

function dbDetail(event: Extract<ChatEvent, { type: "tool_result" }>): string {
  const parts: string[] = [];
  if (event.row_count !== null) parts.push(`${event.row_count} rows`);
  if (event.sql !== null && event.sql !== "") parts.push(event.sql);
  if (event.preview !== "") parts.push(event.preview);
  return parts.join("\n");
}

/** Pure reducer: folds one event into the diagram, showing only what actually happened. */
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
          detail: `${event.tool} ${JSON.stringify(event.args)}`,
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
        { type: "set", nodeId: `db-${n}`, status, detail: dbDetail(event) },
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
