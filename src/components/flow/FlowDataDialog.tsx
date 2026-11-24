"use client";

import { Modal } from "@/components/Modal";
import { JsonView } from "./JsonView";

export interface FlowDataDialogProps {
  title: string;
  /** Short name of the step the data belongs to, shown above the title. */
  subtitle?: string;
  value: unknown;
  closeLabel: string;
  onClose: () => void;
}

/** One node's structured data as highlighted JSON, in a modal. */
export function FlowDataDialog({ title, subtitle, value, closeLabel, onClose }: FlowDataDialogProps) {
  return (
    <Modal title={title} subtitle={subtitle} closeLabel={closeLabel} onClose={onClose}>
      <JsonView value={value} />
    </Modal>
  );
}
