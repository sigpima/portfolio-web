export type NodeStatus = "idle" | "active" | "done" | "error" | "skipped";

/** Structured detail of a node, opened on demand as highlighted JSON (a tool call, a query result). */
export interface FlowNodeData {
  /** Heading of the popup, already localized. */
  title: string;
  /** Any JSON-serializable value. */
  value: unknown;
}

export interface FlowNode {
  id: string;
  label: string;
  sublabel?: string;
  status: NodeStatus;
  /** Short readable text under the node. Without `data` it is shown as a plain text block. */
  detail?: string;
  /** When present the node is clickable and opens `value` as highlighted JSON. */
  data?: FlowNodeData;
}

export interface FlowRow {
  id: string;
  title?: string;
  nodes: FlowNode[];
}

export interface FlowState {
  rows: FlowRow[];
}

export type FlowPatch =
  | { type: "set"; nodeId: string; status: NodeStatus; detail?: string; data?: FlowNodeData }
  | { type: "addRow"; row: FlowRow; /** Insert before the row with this id (append when missing). */ before?: string }
  | { type: "rowTitle"; rowId: string; title: string };

/**
 * Applies one patch without mutating `state`. A `set` keeps the node's current
 * detail and data when the patch has none; an unknown node or row id leaves the state untouched.
 */
export function applyPatch(state: FlowState, patch: FlowPatch): FlowState {
  if (patch.type === "addRow") {
    if (state.rows.some((row) => row.id === patch.row.id)) return state;
    const at = patch.before === undefined ? -1 : state.rows.findIndex((row) => row.id === patch.before);
    if (at === -1) return { rows: [...state.rows, patch.row] };
    return { rows: [...state.rows.slice(0, at), patch.row, ...state.rows.slice(at)] };
  }

  if (patch.type === "rowTitle") {
    if (!state.rows.some((row) => row.id === patch.rowId)) return state;
    return { rows: state.rows.map((row) => (row.id === patch.rowId ? { ...row, title: patch.title } : row)) };
  }

  let found = false;
  const rows = state.rows.map((row) => {
    if (!row.nodes.some((node) => node.id === patch.nodeId)) return row;
    found = true;
    return {
      ...row,
      nodes: row.nodes.map((node) =>
        node.id === patch.nodeId
          ? {
              ...node,
              status: patch.status,
              detail: patch.detail ?? node.detail,
              data: patch.data ?? node.data,
            }
          : node,
      ),
    };
  });
  return found ? { rows } : state;
}
