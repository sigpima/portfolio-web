import { useId, type CSSProperties } from "react";
import type { FlowNode, FlowRow, FlowState, NodeStatus } from "@/lib/flow/model";

export interface FlowPlayerProps {
  state: FlowState;
  /** Accessible name of the whole diagram. */
  label: string;
  /** Localized status text, read by screen readers on every node. */
  statusLabels: Record<NodeStatus, string>;
}

const BOX_BY_STATUS: Record<NodeStatus, string> = {
  idle: "border-outline-variant bg-surface-container",
  active:
    "border-secondary bg-secondary/10 shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-secondary)_15%,transparent),0_0_18px_color-mix(in_srgb,var(--color-secondary)_35%,transparent)]",
  done: "border-primary-container bg-primary-container/15",
  error: "border-error bg-error-container/30",
  skipped: "border-dashed border-outline-variant bg-surface-container-low opacity-70",
};

const CONNECTOR_BY_STATUS: Record<NodeStatus, string> = {
  idle: "bg-outline-variant",
  active:
    "bg-[linear-gradient(90deg,var(--color-secondary),var(--color-outline-variant))] bg-[length:200%_100%] animate-flow-pulse motion-reduce:animate-none",
  done: "bg-primary-container",
  error: "bg-error",
  skipped: "bg-outline-variant opacity-50",
};

/** Decorative, non-color cue for the status. The real status text is sr-only. */
function StatusIcon({ status }: { status: NodeStatus }) {
  const common = {
    "aria-hidden": true,
    focusable: false,
    viewBox: "0 0 12 12",
    className: "size-3 shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (status) {
    case "done":
      return (
        <svg {...common} className="size-3 shrink-0 text-primary">
          <path d="M2.5 6.5 5 9l4.5-5.5" />
        </svg>
      );
    case "error":
      return (
        <svg {...common} className="size-3 shrink-0 text-error">
          <path d="M3 3l6 6M9 3 3 9" />
        </svg>
      );
    case "skipped":
      return (
        <svg {...common} className="size-3 shrink-0 text-outline">
          <path d="M3 6h6" />
        </svg>
      );
    case "active":
      return (
        <svg {...common} className="size-3 shrink-0 text-secondary" fill="currentColor" stroke="none">
          <circle cx="6" cy="6" r="3" className="animate-pulse motion-reduce:animate-none" />
        </svg>
      );
    default:
      return (
        <svg {...common} className="size-3 shrink-0 text-outline-variant">
          <circle cx="6" cy="6" r="3" />
        </svg>
      );
  }
}

function FlowNodeItem({
  node,
  isLast,
  statusLabels,
}: {
  node: FlowNode;
  isLast: boolean;
  statusLabels: Record<NodeStatus, string>;
}) {
  const hasDetail = typeof node.detail === "string" && node.detail.length > 0;
  return (
    <li
      data-status={node.status}
      data-node-id={node.id}
      className="relative min-w-0 max-[720px]:grid max-[720px]:grid-cols-[8rem_minmax(0,1fr)] max-[720px]:items-start max-[720px]:gap-2.5 min-[720px]:px-3"
    >
      <div className="relative">
        <div
          className={`flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2.5 text-center text-code-block transition-[border-color,box-shadow,background-color] duration-300 motion-reduce:transition-none ${BOX_BY_STATUS[node.status]}`}
        >
          <span className="flex max-w-full items-center justify-center gap-1.5 text-on-surface">
            <StatusIcon status={node.status} />
            <span className="min-w-0 break-words">{node.label}</span>
          </span>
          {node.sublabel ? (
            <span className="max-w-full break-words font-mono text-label-mono-xs text-outline">
              {node.sublabel}
            </span>
          ) : null}
          <span className="sr-only">{statusLabels[node.status]}</span>
        </div>
        {!isLast ? (
          <span
            aria-hidden="true"
            className={`absolute top-1/2 left-full hidden h-0.5 w-6 -translate-y-1/2 transition-colors duration-300 motion-reduce:transition-none min-[720px]:block ${CONNECTOR_BY_STATUS[node.status]}`}
          />
        ) : null}
      </div>
      {hasDetail ? (
        <pre
          tabIndex={0}
          role="region"
          aria-label={`${node.label}: ${statusLabels[node.status]}`}
          className="mt-2 max-h-40 overflow-auto rounded-md border border-outline-variant bg-surface-container-lowest p-1.5 font-mono text-[11px] leading-4 break-words whitespace-pre-wrap text-on-surface-variant animate-flow-detail-in motion-reduce:animate-none max-[720px]:mt-0"
        >
          {node.detail}
        </pre>
      ) : null}
    </li>
  );
}

function FlowRowView({
  row,
  statusLabels,
}: {
  row: FlowRow;
  statusLabels: Record<NodeStatus, string>;
}) {
  const titleId = useId();
  const style = { "--flow-cols": row.nodes.length } as CSSProperties;
  return (
    <div className="flex flex-col gap-2">
      {row.title ? (
        <p id={titleId} className="font-mono text-label-mono-sm tracking-wider text-outline uppercase">
          {row.title}
        </p>
      ) : null}
      <ol
        aria-labelledby={row.title ? titleId : undefined}
        style={style}
        className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 min-[720px]:grid-cols-[repeat(var(--flow-cols),minmax(0,1fr))] min-[720px]:items-start min-[720px]:gap-0"
      >
        {row.nodes.map((node, i) => (
          <FlowNodeItem
            key={node.id}
            node={node}
            isLast={i === row.nodes.length - 1}
            statusLabels={statusLabels}
          />
        ))}
      </ol>
    </div>
  );
}

export function FlowPlayer({ state, label, statusLabels }: FlowPlayerProps) {
  return (
    <section
      aria-label={label}
      className="flex flex-col gap-5 rounded-xl border border-outline-variant bg-surface-container-low p-4"
    >
      {state.rows.map((row) => (
        <FlowRowView key={row.id} row={row} statusLabels={statusLabels} />
      ))}
    </section>
  );
}
