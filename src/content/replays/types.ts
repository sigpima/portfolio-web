import type { NodeStatus } from "@/lib/flow/model";
import type { Locale, Localized } from "../types";

export interface ReplaySample {
  id: string;
  title: Localized;
  /** True while the facts (and images, if any) are illustrative stand-ins, not a real run's. */
  placeholder?: boolean;
  input:
    | { kind: "images"; items: { src: string; alt: Localized }[] }
    | { kind: "file"; fileName: string; excerpt: Localized<string[]> }
    /**
     * A chat question, shown as the visitor's bubble. `lang` marks text that is in one
     * language whatever the UI locale (a recorded run asked in Vietnamese).
     */
    | { kind: "question"; text: Localized; lang?: Locale };
  /**
   * Diagram nodes in display order, grouped into rows by `row.id` in first-seen order
   * (a chat run: the question, one row per tool call, the answer). Nodes without `row` share a row `r1`.
   */
  nodes: { id: string; label: Localized; sublabel?: Localized; row?: { id: string; title?: Localized } }[];
  /** Sorted by `atMs` (ms after "play"). */
  steps: {
    atMs: number;
    nodeId: string;
    status: NodeStatus;
    detail?: Localized;
    /** Structured detail opened as JSON on click; `value` is the same in every language. */
    data?: { title: Localized; value: unknown };
  }[];
  result:
    | { kind: "images"; items: { src: string; alt: Localized }[] }
    | {
        kind: "people";
        people: { id: string; name: string; birthYear?: number; deathYear?: number; parentIds: string[] }[];
      }
    /** The bot's answer, shown as a bot bubble once the run is done (`lang` as for the question). */
    | { kind: "text"; text: Localized; lang?: Locale };
}

export interface ReplayDefinition {
  id: string;
  samples: ReplaySample[];
}
