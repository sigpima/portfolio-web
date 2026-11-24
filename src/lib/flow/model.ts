export type NodeStatus = "idle" | "active" | "done" | "error" | "skipped";

/** One passage a policy search returned: which document, which section, how close it scored. */
export interface FlowSource {
  slug: string;
  section: string;
  score: number;
}

/** Structured detail of a node, opened on demand as highlighted JSON (a tool call, a query result). */
export interface FlowNodeData {
  /** Heading of the popup, already localized. */
  title: string;
  /** Short name of the chip on the node that opens it (next to the `{ }` icon), e.g. "Arguments". */
  hint: string;
  /** Any JSON-serializable value. */
  value: unknown;
  /** Policy passages behind `value`, so the popup can offer to open each source. */
  sources?: FlowSource[];
}

export interface FlowNode {
  id: string;
  label: string;
  sublabel?: string;
  status: NodeStatus;
  /** Plain text block under the node (used by the demos whose nodes carry no structured data). */
  detail?: string;
  /** Short text (a duration) shown as a chip inside the node, on the same line as the data chip. */
  meta?: string;
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
  | {
      type: "set";
      nodeId: string;
      status: NodeStatus;
      label?: string;
      sublabel?: string;
      detail?: string;
      meta?: string;
      data?: FlowNodeData;
    }
  | { type: "addRow"; row: FlowRow; /** Insert before the row with this id (append when missing). */ before?: string }
  | { type: "rowTitle"; rowId: string; title: string };

/**
 * Applies one patch without mutating `state`. A `set` keeps the node's current
 * detail, meta and data when the patch has none; an unknown node or row id leaves the state untouched.
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
              label: patch.label ?? node.label,
              sublabel: patch.sublabel ?? node.sublabel,
              detail: patch.detail ?? node.detail,
              meta: patch.meta ?? node.meta,
              data: patch.data ?? node.data,
            }
          : node,
      ),
    };
  });
  return found ? { rows } : state;
}
