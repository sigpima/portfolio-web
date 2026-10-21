import type { NodeStatus } from "@/lib/flow/model";
import type { Localized } from "../types";

export interface ReplaySample {
  id: string;
  title: Localized;
  /** True while the images and facts are illustrative stand-ins, not a real run's. */
  placeholder?: boolean;
  input:
    | { kind: "images"; items: { src: string; alt: Localized }[] }
    | { kind: "file"; fileName: string; excerpt: Localized<string[]> }
    /** A chat question, shown as the visitor's bubble. */
    | { kind: "question"; text: Localized };
  /**
   * Diagram nodes in display order. Nodes without `row` sit on the first row (`r1`);
   * the others are grouped into extra rows (e.g. a second tool call), in first-seen order.
   */
  nodes: { id: string; label: Localized; sublabel?: Localized; row?: { id: string; title?: Localized } }[];
  /** Sorted by `atMs` (ms after "play"). */
  steps: { atMs: number; nodeId: string; status: NodeStatus; detail?: Localized }[];
  result:
    | { kind: "images"; items: { src: string; alt: Localized }[] }
    | {
        kind: "people";
        people: { id: string; name: string; birthYear?: number; deathYear?: number; parentIds: string[] }[];
      }
    /** The bot's answer, shown as a bot bubble once the run is done. */
    | { kind: "text"; text: Localized };
}

export interface ReplayDefinition {
  id: string;
  samples: ReplaySample[];
}
