import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReplaySample } from "@/content/replays/types";
import type { FlowState, NodeStatus } from "@/lib/flow/model";
import { useReplay } from "./use-replay";

function sample(id = "s1"): ReplaySample {
  return {
    id,
    title: { vi: "Mẫu", en: "Sample" },
    input: { kind: "file", fileName: "x.docx", excerpt: { vi: ["a"], en: ["a"] } },
    nodes: [
      { id: "a", label: { vi: "Bước A", en: "Step A" }, sublabel: { vi: "phụ", en: "sub" } },
      { id: "b", label: { vi: "Bước B", en: "Step B" } },
    ],
    steps: [
      { atMs: 0, nodeId: "a", status: "active" },
      { atMs: 100, nodeId: "a", status: "done", detail: { vi: "xong A", en: "A done" } },
      { atMs: 200, nodeId: "b", status: "active" },
      { atMs: 300, nodeId: "b", status: "done", detail: { vi: "xong B", en: "B done" } },
    ],
    result: { kind: "people", people: [] },
  };
}

function statuses(flow: FlowState): NodeStatus[] {
  return flow.rows[0].nodes.map((n) => n.status);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useReplay", () => {
  it("starts idle with one row of localized idle nodes", () => {
    const s = sample();
    const { result } = renderHook(() => useReplay(s, "en"));
    expect(result.current.status).toBe("idle");
    expect(result.current.showResult).toBe(false);
    expect(result.current.flow.rows).toHaveLength(1);
    expect(result.current.flow.rows[0].id).toBe("r1");
    expect(result.current.flow.rows[0].nodes).toEqual([
      { id: "a", label: "Step A", sublabel: "sub", status: "idle" },
      { id: "b", label: "Step B", sublabel: undefined, status: "idle" },
    ]);
  });

  it("applies the steps in time order and shows the result after the last one", () => {
    const s = sample();
    const { result } = renderHook(() => useReplay(s, "vi"));
    act(() => result.current.play());
    expect(result.current.status).toBe("playing");
    act(() => vi.advanceTimersByTime(0));
    expect(statuses(result.current.flow)).toEqual(["active", "idle"]);
    act(() => vi.advanceTimersByTime(100));
    expect(statuses(result.current.flow)).toEqual(["done", "idle"]);
    expect(result.current.flow.rows[0].nodes[0].detail).toBe("xong A");
    act(() => vi.advanceTimersByTime(100));
    expect(statuses(result.current.flow)).toEqual(["done", "active"]);
    expect(result.current.showResult).toBe(false);
    act(() => vi.advanceTimersByTime(100));
    expect(statuses(result.current.flow)).toEqual(["done", "done"]);
    expect(result.current.status).toBe("done");
    expect(result.current.showResult).toBe(true);
  });

  it("reset() clears pending timers and returns to the initial state", () => {
    const s = sample();
    const { result } = renderHook(() => useReplay(s, "vi"));
    act(() => result.current.play());
    act(() => vi.advanceTimersByTime(150));
    act(() => result.current.reset());
    expect(result.current.status).toBe("idle");
    expect(statuses(result.current.flow)).toEqual(["idle", "idle"]);
    expect(result.current.flow.rows[0].nodes[0].detail).toBeUndefined();
    act(() => vi.advanceTimersByTime(1000));
    expect(statuses(result.current.flow)).toEqual(["idle", "idle"]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("calling play() twice does not duplicate or accelerate the steps", () => {
    const s = sample();
    const { result } = renderHook(() => useReplay(s, "vi"));
    act(() => {
      result.current.play();
      result.current.play();
    });
    act(() => result.current.play());
    expect(vi.getTimerCount()).toBe(s.steps.length);
    act(() => vi.advanceTimersByTime(250));
    expect(statuses(result.current.flow)).toEqual(["done", "active"]);
    expect(result.current.status).toBe("playing");
  });

  it("play() after done replays from the start", () => {
    const s = sample();
    const { result } = renderHook(() => useReplay(s, "vi"));
    act(() => result.current.play());
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.status).toBe("done");
    act(() => result.current.play());
    expect(result.current.status).toBe("playing");
    expect(result.current.showResult).toBe(false);
    expect(statuses(result.current.flow)).toEqual(["idle", "idle"]);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.status).toBe("done");
  });

  it("reducedMotion jumps straight to the final state without timers", () => {
    const s = sample();
    const { result } = renderHook(() => useReplay(s, "en", { reducedMotion: true }));
    act(() => result.current.play());
    expect(vi.getTimerCount()).toBe(0);
    expect(result.current.status).toBe("done");
    expect(result.current.showResult).toBe(true);
    expect(statuses(result.current.flow)).toEqual(["done", "done"]);
    expect(result.current.flow.rows[0].nodes[1].detail).toBe("B done");
  });

  it("clears all timers on unmount, with no late state updates or act warnings", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const s = sample();
    const { result, unmount } = renderHook(() => useReplay(s, "vi"));
    act(() => result.current.play());
    act(() => vi.advanceTimersByTime(50));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(error).not.toHaveBeenCalled();
  });

  it("switching the sample mid-play clears timers and resets to the new sample", () => {
    const first = sample("s1");
    const second = sample("s2");
    second.nodes = [{ id: "x", label: { vi: "Nút X", en: "Node X" } }];
    second.steps = [{ atMs: 0, nodeId: "x", status: "done" }];
    const { result, rerender } = renderHook(({ s }) => useReplay(s, "vi"), {
      initialProps: { s: first },
    });
    act(() => result.current.play());
    act(() => vi.advanceTimersByTime(150));
    rerender({ s: second });
    expect(vi.getTimerCount()).toBe(0);
    expect(result.current.status).toBe("idle");
    expect(result.current.flow.rows[0].nodes.map((n) => [n.id, n.status])).toEqual([["x", "idle"]]);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.status).toBe("idle");
  });

  it("re-localizes labels and details when the locale changes", () => {
    const s = sample();
    const { result, rerender } = renderHook(({ l }) => useReplay(s, l), {
      initialProps: { l: "vi" as "vi" | "en" },
    });
    act(() => result.current.play());
    act(() => vi.advanceTimersByTime(1000));
    rerender({ l: "en" });
    expect(result.current.flow.rows[0].nodes[0].label).toBe("Step A");
    expect(result.current.flow.rows[0].nodes[0].detail).toBe("A done");
    expect(result.current.status).toBe("done");
  });
});
