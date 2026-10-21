export type NodeStatus = "idle" | "active" | "done" | "error" | "skipped";

export interface FlowNode {
  id: string;
  label: string;
  sublabel?: string;
  status: NodeStatus;
  detail?: string;
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
  | { type: "set"; nodeId: string; status: NodeStatus; detail?: string }
  | { type: "addRow"; row: FlowRow };

/**
 * Applies one patch without mutating `state`. A `set` keeps the node's current
 * detail when the patch has none; an unknown node id leaves the state untouched.
 */
export function applyPatch(state: FlowState, patch: FlowPatch): FlowState {
  if (patch.type === "addRow") {
    if (state.rows.some((row) => row.id === patch.row.id)) return state;
    return { rows: [...state.rows, patch.row] };
  }

  let found = false;
  const rows = state.rows.map((row) => {
    if (!row.nodes.some((node) => node.id === patch.nodeId)) return row;
    found = true;
    return {
      ...row,
      nodes: row.nodes.map((node) =>
        node.id === patch.nodeId
          ? { ...node, status: patch.status, detail: patch.detail ?? node.detail }
          : node,
      ),
    };
  });
  return found ? { rows } : state;
}
