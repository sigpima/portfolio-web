"use client";

import { Modal } from "@/components/Modal";
import type { FlowSource } from "@/lib/flow/model";
import { JsonView } from "./JsonView";

export interface FlowDataDialogProps {
  title: string;
  /** Short name of the step the data belongs to, shown above the title. */
  subtitle?: string;
  value: unknown;
  closeLabel: string;
  onClose: () => void;
  /** Policy passages behind the JSON; with `onOpenSource` each one is offered as a button above it. */
  sources?: FlowSource[];
  onOpenSource?: (source: FlowSource) => void;
  /** A line above the JSON, e.g. that the result was cut off. */
  note?: string;
}

/** One node's structured data as highlighted JSON, in a modal. */
export function FlowDataDialog({
  title,
  subtitle,
  value,
  closeLabel,
  onClose,
  sources,
  onOpenSource,
  note,
}: FlowDataDialogProps) {
  return (
    <Modal title={title} subtitle={subtitle} closeLabel={closeLabel} onClose={onClose}>
      {sources && sources.length > 0 && onOpenSource ? (
        <ul data-role="sources" className="mb-4 flex flex-col gap-1.5">
          {sources.map((source, i) => (
            <li key={`${i}-${source.slug}-${source.section}`}>
              <button
                type="button"
                onClick={() => onOpenSource(source)}
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-left font-mono text-label-mono-sm break-words text-secondary hover:border-secondary hover:bg-secondary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
              >
                {source.slug} › {source.section} · {source.score.toFixed(2)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {note ? (
        <p
          data-role="partial-note"
          className="mb-3 rounded-lg border border-outline-variant px-3 py-2 text-body-md text-on-surface-variant"
        >
          {note}
        </p>
      ) : null}
      <JsonView value={value} />
    </Modal>
  );
}
