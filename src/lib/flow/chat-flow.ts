import type { ChatEvent } from "@/lib/chat/types";
import { applyPatch, type FlowNode, type FlowNodeData, type FlowPatch, type FlowRow, type FlowSource, type FlowState } from "./model";

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
  /** Popup headings, and the short chip names on the nodes that open them. */
  callData: string;
  callHint: string;
  resultData: string;
  resultHint: string;
  /** The third node of a call to the policy search: a vector store, not Postgres. */
  policyStore: NodeLabel;
  policyResultData: string;
  policyResultHint: string;
}

/** The MCP tool that searches the policy documents (RAG). */
export const POLICY_TOOL = "search_policies";

/** Row ids: the question first, one row per tool call, the answer last. */
export const START_ROW = "start";
export const END_ROW = "end";
export const callRowId = (n: number) => `call-${n}`;

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

/**
 * The chat service lists the passages of a policy search one per line, `<slug> › <section> · <score>`.
 * The slug ends at the first separator and the score starts at the last dot, because the section is
 * itself a path that contains the separator. Anything else (an error text, an odd line) gives null.
 */
export function parsePolicyPreview(preview: string): FlowSource[] | null {
  const lines = preview.split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0) return null;
  const sources: FlowSource[] = [];
  for (const line of lines) {
    const slugEnd = line.indexOf(" › ");
    const scoreStart = line.lastIndexOf(" · ");
    if (slugEnd <= 0 || scoreStart <= slugEnd + 3) return null;
    const scoreText = line.slice(scoreStart + 3).trim();
    const score = Number(scoreText);
    const section = line.slice(slugEnd + 3, scoreStart);
    if (scoreText === "" || !Number.isFinite(score) || section.trim() === "") return null;
    sources.push({ slug: line.slice(0, slugEnd), section, score });
  }
  return sources;
}

/** The chat service cuts every preview at this many characters (knowledge_base `events.py`). */
const PREVIEW_MAX_CHARS = 800;

/** The data of a policy search result: the passages when they parse, an error text when it failed. */
function policyData(event: Extract<ChatEvent, { type: "tool_result" }>, labels: FlowLabels): FlowNodeData | null {
  const base = { title: labels.policyResultData, hint: labels.policyResultHint };
  if (!event.ok) return { ...base, value: { error: event.preview } };
  // A search that found nothing sends an empty preview: still a policy result, with no passages.
  if (event.preview.trim() === "") {
    return { ...base, sources: [], value: [] };
  }
  // A cut preview ends mid-line, and a score cut at "0.7" would still parse: drop that last line.
  const text =
    event.preview.length >= PREVIEW_MAX_CHARS ? event.preview.split("\n").slice(0, -1).join("\n") : event.preview;
  const sources = parsePolicyPreview(text);
  if (sources === null) return null;
  return { ...base, sources, value: sources };
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

/** What the result popup shows: the preview (parsed when it is JSON), or the error text of a failed call. */
function resultValue(event: Extract<ChatEvent, { type: "tool_result" }>): unknown {
  return event.ok ? parsePreview(event.preview) : { error: event.preview };
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
          data: { title: labels.callData, hint: labels.callHint, value: { tool: event.tool, args: event.args } },
        },
        { type: "set", nodeId: `tool-${n}`, status: "active" },
        ...(event.tool === POLICY_TOOL
          ? [{ type: "set", nodeId: `db-${n}`, status: "idle", ...labels.policyStore } as FlowPatch]
          : []),
        { type: "set", nodeId: "answer", status: "idle" },
      ]);
    }

    case "tool_result": {
      const n = event.call_id;
      if (!Number.isInteger(n) || n < 1) return state;
      const status = event.ok ? "done" : "error";
      return patchAll(ensureCallRow(state, n, labels), [
        { type: "set", nodeId: `tool-${n}`, status, meta: `${event.duration_ms} ms` },
        {
          type: "set",
          nodeId: `db-${n}`,
          status,
          data:
            (event.tool === POLICY_TOOL ? policyData(event, labels) : null) ?? {
              title: labels.resultData,
              hint: labels.resultHint,
              value: resultValue(event),
            },
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
