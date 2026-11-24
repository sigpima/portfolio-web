"use client";

import { Fragment, useId, useState, type CSSProperties } from "react";
import type { FlowNode, FlowRow, FlowSource, FlowState, NodeStatus } from "@/lib/flow/model";
import { FlowDataDialog } from "./FlowDataDialog";

export interface FlowDataLabels {
  /** Accessible hint on a node that opens its JSON, e.g. "View details (JSON)". */
  open: string;
  /** Label of the popup's close button. */
  close: string;
  /** Note shown above a result that was cut off, e.g. "Long result: only the beginning is shown." */
  partial: string;
}

export interface FlowPlayerProps {
  state: FlowState;
  /** Accessible name of the whole diagram. */
  label: string;
  /** Localized status text, read by screen readers on every node. */
  statusLabels: Record<NodeStatus, string>;
  /** Without it, nodes that carry `data` are plain boxes: nothing opens. */
  dataLabels?: FlowDataLabels;
  /** Opens a policy source listed in a node's popup (the popup closes first); `reopen` brings that popup back. */
  onOpenSource?: (source: FlowSource, reopen: () => void) => void;
}

/** Colour of the vertical link that leads into the next row, from the row above it. */
const ROW_LINK_BY_STATUS: Record<NodeStatus, string> = {
  idle: "bg-outline-variant",
  active: "bg-secondary",
  done: "bg-primary-container",
  error: "bg-error",
  skipped: "bg-outline-variant opacity-50",
};

const BOX_BY_STATUS: Record<NodeStatus, string> = {
  idle: "border-outline-variant bg-surface-container",
  active:
    "border-secondary bg-secondary/10 shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-secondary)_15%,transparent),0_0_18px_color-mix(in_srgb,var(--color-secondary)_35%,transparent)]",
  done: "border-primary-container bg-primary-container/15",
  error: "border-error bg-error-container/30",
  skipped: "border-dashed border-outline-variant bg-surface-container-low",
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

const CHIP_CLASS =
  "inline-flex items-center gap-1 rounded border border-outline-variant px-1.5 py-0.5 font-mono text-label-mono-xs text-on-surface-variant";

function NodeBox({
  node,
  labelId,
  statusLabels,
  dataLabels,
  stretch,
  onOpen,
}: {
  node: FlowNode;
  labelId: string;
  statusLabels: Record<NodeStatus, string>;
  dataLabels?: FlowDataLabels;
  /** Fill the height of the row, so the boxes of one row are equally tall. */
  stretch: boolean;
  onOpen: () => void;
}) {
  const clickable = node.data !== undefined && dataLabels !== undefined;
  const boxClass = `flex min-h-[58px] w-full flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2.5 text-center text-code-block transition-[border-color,box-shadow,background-color] duration-300 motion-reduce:transition-none ${stretch ? "h-full" : ""} ${BOX_BY_STATUS[node.status]}`;
  const hasChips = clickable || node.meta !== undefined;
  const content = (
    <>
      <span className="flex max-w-full items-center justify-center gap-1.5 text-on-surface">
        <StatusIcon status={node.status} />
        <span id={labelId} className="min-w-0 break-words">
          {node.label}
        </span>
      </span>
      {node.sublabel ? (
        <span className="max-w-full break-words font-mono text-label-mono-xs text-on-surface-variant">
          {node.sublabel}
        </span>
      ) : null}
      {hasChips ? (
        <span className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
          {node.meta !== undefined ? (
            <span data-role="node-meta" className={CHIP_CLASS}>
              {node.meta}
            </span>
          ) : null}
          {clickable ? (
            <span
              data-role="node-data-chip"
              aria-hidden="true"
              className={`${CHIP_CLASS} group-hover:border-secondary group-hover:text-secondary`}
            >
              {"{ }"} {node.data!.hint}
            </span>
          ) : null}
        </span>
      ) : null}
      <span className="sr-only">{statusLabels[node.status]}</span>
      {clickable ? (
        <span className="sr-only">
          {node.data!.hint}: {dataLabels.open}
        </span>
      ) : null}
    </>
  );
  if (!clickable) return <div className={boxClass}>{content}</div>;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onOpen}
      className={`group cursor-pointer hover:border-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${boxClass}`}
    >
      {content}
    </button>
  );
}

function FlowNodeItem({
  node,
  isLast,
  idPrefix,
  statusLabels,
  dataLabels,
  compact,
  onOpen,
}: {
  node: FlowNode;
  isLast: boolean;
  idPrefix: string;
  statusLabels: Record<NodeStatus, string>;
  dataLabels?: FlowDataLabels;
  /** The row shows chips inside its boxes (no text block under them), so its boxes are equalized. */
  compact: boolean;
  onOpen: (nodeId: string) => void;
}) {
  const labelId = `${idPrefix}-${node.id}-label`;
  const hasDetail = typeof node.detail === "string" && node.detail.length > 0;
  return (
    <li
      data-status={node.status}
      data-node-id={node.id}
      className={`relative min-w-0 min-[720px]:px-3 ${
        compact
          ? "flex flex-col"
          : "max-[720px]:grid max-[720px]:grid-cols-[8rem_minmax(0,1fr)] max-[720px]:items-start max-[720px]:gap-2.5"
      }`}
    >
      <div className={`relative ${compact ? "flex-1" : ""}`}>
        <NodeBox
          node={node}
          labelId={labelId}
          statusLabels={statusLabels}
          dataLabels={dataLabels}
          stretch={compact}
          onOpen={() => onOpen(node.id)}
        />
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
          role="group"
          aria-labelledby={labelId}
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
  dataLabels,
  onOpen,
}: {
  row: FlowRow;
  statusLabels: Record<NodeStatus, string>;
  dataLabels?: FlowDataLabels;
  onOpen: (nodeId: string) => void;
}) {
  const titleId = useId();
  const idPrefix = useId();
  const style = { "--flow-cols": row.nodes.length } as CSSProperties;
  // A row with a single node (the question, the answer) is as wide as one column of a call row, centred.
  const single = row.nodes.length === 1;
  // Rows whose nodes carry chips (data, durations) keep every box the same height.
  const compact = !single && dataLabels !== undefined && row.nodes.some((n) => n.data !== undefined || n.meta !== undefined);
  return (
    <div data-row-id={row.id} className="flex flex-col gap-2">
      {row.title ? (
        <p id={titleId} className="font-mono text-label-mono-sm tracking-wider text-outline uppercase">
          {row.title}
        </p>
      ) : null}
      <ol
        role="list"
        aria-labelledby={row.title ? titleId : undefined}
        style={style}
        className={`m-0 grid list-none grid-cols-1 gap-2.5 p-0 min-[720px]:grid-cols-[repeat(var(--flow-cols),minmax(0,1fr))] ${compact ? "min-[720px]:items-stretch" : "min-[720px]:items-start"} min-[720px]:gap-0 ${single ? "min-[720px]:mx-auto min-[720px]:w-1/3" : ""}`}
      >
        {row.nodes.map((node, i) => (
          <FlowNodeItem
            key={node.id}
            node={node}
            isLast={i === row.nodes.length - 1}
            idPrefix={idPrefix}
            statusLabels={statusLabels}
            dataLabels={dataLabels}
            compact={compact}
            onOpen={onOpen}
          />
        ))}
      </ol>
    </div>
  );
}

export function FlowPlayer({ state, label, statusLabels, dataLabels, onOpenSource }: FlowPlayerProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openNode =
    openId === null ? undefined : state.rows.flatMap((row) => row.nodes).find((node) => node.id === openId);

  return (
    <section
      aria-label={label}
      className="flex flex-col rounded-xl border border-outline-variant bg-surface-container-low p-4"
    >
      {state.rows.map((row, i) => {
        const above = state.rows[i - 1]?.nodes.at(-1);
        return (
          <Fragment key={row.id}>
            {above ? (
              <span
                aria-hidden="true"
                data-role="row-link"
                data-status={above.status}
                className={`mx-auto my-1.5 h-5 w-0.5 rounded-full transition-colors duration-300 motion-reduce:transition-none ${ROW_LINK_BY_STATUS[above.status]}`}
              />
            ) : null}
            <FlowRowView row={row} statusLabels={statusLabels} dataLabels={dataLabels} onOpen={setOpenId} />
          </Fragment>
        );
      })}
      {openNode?.data && dataLabels ? (
        <FlowDataDialog
          title={openNode.data.title}
          subtitle={openNode.label}
          value={openNode.data.value}
          closeLabel={dataLabels.close}
          onClose={() => setOpenId(null)}
          sources={openNode.data.sources}
          note={openNode.data.partial ? dataLabels.partial : undefined}
          onOpenSource={
            onOpenSource
              ? (source) => {
                  const nodeId = openId;
                  setOpenId(null);
                  onOpenSource(source, () => setOpenId(nodeId));
                }
              : undefined
          }
        />
      ) : null}
    </section>
  );
}
