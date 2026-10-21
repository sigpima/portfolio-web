import type { NodeStatus } from "@/lib/flow/model";
import type { Localized } from "../types";

export interface ReplaySample {
  id: string;
  title: Localized;
  /** True while the images and facts are illustrative stand-ins, not a real run's. */
  placeholder?: boolean;
  input:
    | { kind: "images"; items: { src: string; alt: Localized }[] }
    | { kind: "file"; fileName: string; excerpt: Localized<string[]> };
  nodes: { id: string; label: Localized; sublabel?: Localized }[];
  /** Sorted by `atMs` (ms after "play"). */
  steps: { atMs: number; nodeId: string; status: NodeStatus; detail?: Localized }[];
  result:
    | { kind: "images"; items: { src: string; alt: Localized }[] }
    | {
        kind: "people";
        people: { id: string; name: string; birthYear?: number; deathYear?: number; parentIds: string[] }[];
      };
}

export interface ReplayDefinition {
  id: string;
  samples: ReplaySample[];
}
