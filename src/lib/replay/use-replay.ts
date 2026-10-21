"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReplaySample } from "@/content/replays/types";
import type { Locale } from "@/content/types";
import { applyPatch, type FlowRow, type FlowState } from "@/lib/flow/model";

export type ReplayStatus = "idle" | "playing" | "done";

export interface UseReplayResult {
  flow: FlowState;
  status: ReplayStatus;
  /** True once the last step has been applied. */
  showResult: boolean;
  /** Starts the replay. Ignored while playing; after "done" it replays from the start. */
  play(): void;
  /** Cancels pending steps and returns to the initial, all-idle state. */
  reset(): void;
}

interface ReplayState {
  /** The sample this state belongs to; a different sample means "start over". */
  sample: ReplaySample;
  status: ReplayStatus;
  /** How many of `sample.steps` have been applied. */
  count: number;
}

/**
 * Every node idle with its labels in `locale`: row `r1` first, then any extra rows
 * (`node.row`) in first-seen order.
 */
export function initialReplayFlow(sample: ReplaySample, locale: Locale): FlowState {
  const rows: FlowRow[] = [{ id: "r1", nodes: [] }];
  for (const node of sample.nodes) {
    const rowId = node.row?.id ?? "r1";
    let row = rows.find((r) => r.id === rowId);
    if (!row) {
      row = { id: rowId, title: node.row?.title?.[locale], nodes: [] };
      rows.push(row);
    }
    row.nodes.push({
      id: node.id,
      label: node.label[locale],
      sublabel: node.sublabel?.[locale],
      status: "idle",
    });
  }
  return { rows };
}

/** The flow after the first `count` steps, localized in `locale`. */
export function replayFlowAt(sample: ReplaySample, locale: Locale, count: number): FlowState {
  return sample.steps.slice(0, count).reduce<FlowState>(
    (flow, step) =>
      applyPatch(flow, {
        type: "set",
        nodeId: step.nodeId,
        status: step.status,
        detail: step.detail?.[locale],
      }),
    initialReplayFlow(sample, locale),
  );
}

/**
 * Plays a recorded sample's steps back on a timer (`setTimeout` at each `atMs`).
 * The flow is derived from how many steps have run, so switching the locale
 * re-localizes it without restarting. Switching the sample or unmounting clears
 * every pending timer; `reducedMotion` jumps straight to the final state.
 */
export function useReplay(
  sample: ReplaySample,
  locale: Locale,
  opts: { reducedMotion?: boolean } = {},
): UseReplayResult {
  const reducedMotion = opts.reducedMotion ?? false;
  const [stored, setStored] = useState<ReplayState>({ sample, status: "idle", count: 0 });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Synchronous mirror of the status, so two `play()` calls in one tick cannot both start. */
  const statusRef = useRef<ReplayStatus>("idle");

  // A new sample starts over (adjusting state during render; the effect below clears its timers).
  let state = stored;
  if (stored.sample !== sample) {
    state = { sample, status: "idle", count: 0 };
    setStored(state);
  }

  const clearTimers = useCallback(() => {
    for (const id of timers.current) clearTimeout(id);
    timers.current = [];
  }, []);

  useEffect(
    () => () => {
      clearTimers();
      statusRef.current = "idle";
    },
    [sample, clearTimers],
  );

  const play = useCallback(() => {
    if (statusRef.current === "playing") return;
    clearTimers();
    const total = sample.steps.length;
    if (reducedMotion || total === 0) {
      statusRef.current = "done";
      setStored({ sample, status: "done", count: total });
      return;
    }
    statusRef.current = "playing";
    setStored({ sample, status: "playing", count: 0 });
    timers.current = sample.steps.map((step, i) =>
      setTimeout(() => {
        const last = i === total - 1;
        if (last) {
          statusRef.current = "done";
          timers.current = [];
        }
        setStored((prev) =>
          prev.sample === sample
            ? { sample, status: last ? "done" : "playing", count: Math.max(prev.count, i + 1) }
            : prev,
        );
      }, step.atMs),
    );
  }, [clearTimers, reducedMotion, sample]);

  const reset = useCallback(() => {
    clearTimers();
    statusRef.current = "idle";
    setStored({ sample, status: "idle", count: 0 });
  }, [clearTimers, sample]);

  const flow = useMemo(() => replayFlowAt(sample, locale, state.count), [sample, locale, state.count]);

  return { flow, status: state.status, showResult: state.status === "done", play, reset };
}
