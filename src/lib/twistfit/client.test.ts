// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assetUrl, fetchCatalog, pollJob, resultUrl, startRun, TwistfitError } from "./client";
import { parseCatalog, parseJobStatus, type JobStatus } from "./types";

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const CATALOG = {
  max_items: 3,
  models: [{ id: "m1", name: { vi: "Lan", en: "Lan" } }],
  items: [
    { id: "ao-1", name: { vi: "Áo sơ mi", en: "Shirt" } },
    { id: "quan_2", name: { vi: "Quần jean", en: "Jeans" } },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("parseCatalog", () => {
  it("accepts a well-formed catalog", () => {
    expect(parseCatalog(CATALOG)).toEqual(CATALOG);
  });

  it("drops unknown fields", () => {
    const parsed = parseCatalog({
      ...CATALOG,
      extra: 1,
      models: [{ id: "m1", name: { vi: "Lan", en: "Lan", fr: "x" }, path: "/secret" }],
    });
    expect(parsed?.models).toEqual([{ id: "m1", name: { vi: "Lan", en: "Lan" } }]);
    expect(parsed).not.toHaveProperty("extra");
  });

  it.each([
    ["not an object", null],
    ["an array", [CATALOG]],
    ["max_items not an integer", { ...CATALOG, max_items: 2.5 }],
    ["max_items below 1", { ...CATALOG, max_items: 0 }],
    ["max_items absurdly large", { ...CATALOG, max_items: 1000 }],
    ["models missing", { ...CATALOG, models: undefined }],
    ["no models", { ...CATALOG, models: [] }],
    ["no items", { ...CATALOG, items: [] }],
    ["an item without name", { ...CATALOG, items: [{ id: "a" }] }],
    ["a name missing en", { ...CATALOG, items: [{ id: "a", name: { vi: "Áo" } }] }],
    ["an empty name", { ...CATALOG, items: [{ id: "a", name: { vi: "", en: "x" } }] }],
    ["a path-like id", { ...CATALOG, items: [{ id: "../x", name: { vi: "a", en: "a" } }] }],
    ["an id too long", { ...CATALOG, items: [{ id: "a".repeat(65), name: { vi: "a", en: "a" } }] }],
    [
      "duplicate ids",
      {
        ...CATALOG,
        items: [
          { id: "a", name: { vi: "a", en: "a" } },
          { id: "a", name: { vi: "b", en: "b" } },
        ],
      },
    ],
    [
      "too many items",
      {
        ...CATALOG,
        items: Array.from({ length: 101 }, (_, i) => ({ id: `i${i}`, name: { vi: "a", en: "a" } })),
      },
    ],
  ])("rejects %s", (_label, value) => {
    expect(parseCatalog(value)).toBeNull();
  });
});

describe("parseJobStatus", () => {
  it("accepts running, done and error shapes", () => {
    expect(parseJobStatus({ status: "running", stage: "waiting", elapsed_seconds: 12 })).toEqual({
      status: "running",
      stage: "waiting",
      elapsed_seconds: 12,
    });
    expect(
      parseJobStatus({ status: "done", stage: "downloading", elapsed_seconds: 40, result_id: "r_1-x" }),
    ).toEqual({ status: "done", stage: "downloading", elapsed_seconds: 40, result_id: "r_1-x" });
    expect(parseJobStatus({ status: "error", stage: "waiting", elapsed_seconds: 3, code: "flux_failed" })).toEqual({
      status: "error",
      stage: "waiting",
      elapsed_seconds: 3,
      code: "flux_failed",
    });
  });

  it.each([
    ["not an object", "done"],
    ["an unknown status", { status: "queued", elapsed_seconds: 0 }],
    ["an unknown stage", { status: "running", stage: "painting", elapsed_seconds: 0 }],
    ["a negative elapsed", { status: "running", elapsed_seconds: -1 }],
    ["a non-numeric elapsed", { status: "running", elapsed_seconds: "3" }],
    ["done without result_id", { status: "done", elapsed_seconds: 3 }],
    ["a bad result_id", { status: "done", elapsed_seconds: 3, result_id: "../../etc" }],
    ["error without code", { status: "error", elapsed_seconds: 3 }],
    ["a code that is free text", { status: "error", elapsed_seconds: 3, code: "Flux said: <b>no</b>" }],
  ])("rejects %s", (_label, value) => {
    expect(parseJobStatus(value)).toBeNull();
  });
});

describe("urls", () => {
  it("points images at the web proxy", () => {
    expect(assetUrl("items", "ao-1")).toBe("/api/twistfit/assets/items/ao-1");
    expect(assetUrl("models", "m1")).toBe("/api/twistfit/assets/models/m1");
    expect(resultUrl("r_1")).toBe("/api/twistfit/results/r_1");
  });

  it("encodes ids so they cannot escape the path", () => {
    expect(resultUrl("../x")).toBe("/api/twistfit/results/..%2Fx");
  });
});

describe("fetchCatalog", () => {
  it("GETs the catalog same-origin and parses it", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => Response.json(CATALOG));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchCatalog()).resolves.toEqual(CATALOG);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/twistfit/catalog");
    expect(init?.credentials).toBe("same-origin");
    expect(init?.cache).toBe("no-store");
  });

  it("maps a 401 to invite_required", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "invite_required" }, { status: 401 })));
    await expect(fetchCatalog()).rejects.toMatchObject({ name: "TwistfitError", code: "invite_required", status: 401 });
  });

  it("maps a 401 without a body to invite_required too", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    await expect(fetchCatalog()).rejects.toMatchObject({ code: "invite_required", status: 401 });
  });

  it("relays the server code on other errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "demo_disabled" }, { status: 503 })));
    await expect(fetchCatalog()).rejects.toMatchObject({ code: "demo_disabled", status: 503 });
  });

  it("uses internal when the error body has no code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 502 })));
    await expect(fetchCatalog()).rejects.toMatchObject({ code: "internal", status: 502 });
  });

  it("rejects a malformed catalog as invalid_response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ models: "x" })));
    await expect(fetchCatalog()).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("maps a network failure to network", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("failed to fetch");
      }),
    );
    await expect(fetchCatalog()).rejects.toMatchObject({ code: "network", status: 0 });
  });

  it("lets an abort through as an AbortError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        init?.signal?.throwIfAborted();
        return Response.json(CATALOG);
      }),
    );
    const controller = new AbortController();
    controller.abort();
    await expect(fetchCatalog(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("startRun", () => {
  it("POSTs JSON same-origin and returns the job id", async () => {
    const fetchMock = vi.fn<FetchFn>(async () =>
      Response.json({ job_id: "job_1" }, { status: 202 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(startRun({ items: ["ao-1", "quan_2"], model: "m1" })).resolves.toEqual({ jobId: "job_1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/twistfit/run");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("same-origin");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual({ items: ["ao-1", "quan_2"], model: "m1" });
  });

  it.each([
    [401, "invite_required"],
    [413, "too_long"],
    [422, "invalid_request"],
    [429, "busy"],
    [429, "twistfit_limit"],
    [503, "demo_disabled"],
  ])("maps HTTP %i {code:%s} to a TwistfitError", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code }, { status })));
    const err = await startRun({ items: ["a"], model: "m" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TwistfitError);
    expect(err).toMatchObject({ code, status });
  });

  it("rejects a job id with a bad shape", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ job_id: "../x" }, { status: 202 })));
    await expect(startRun({ items: ["a"], model: "m" })).rejects.toMatchObject({ code: "invalid_response" });
  });
});

describe("pollJob", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  function jobFetch(statuses: (JobStatus | Response)[]) {
    let i = 0;
    return vi.fn<FetchFn>(async () => {
      const next = statuses[Math.min(i++, statuses.length - 1)];
      return next instanceof Response ? next : Response.json(next);
    });
  }

  it("calls onUpdate on every poll and resolves on done", async () => {
    const fetchMock = jobFetch([
      { status: "running", stage: "merging", elapsed_seconds: 0 },
      { status: "running", stage: "waiting", elapsed_seconds: 2 },
      { status: "done", stage: "downloading", elapsed_seconds: 4, result_id: "r1" },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const onUpdate = vi.fn();
    const promise = pollJob("job_1", { onUpdate, signal: new AbortController().signal });
    await vi.advanceTimersByTimeAsync(1500 * 3);
    await expect(promise).resolves.toEqual({ status: "done", stage: "downloading", elapsed_seconds: 4, result_id: "r1" });
    expect(onUpdate.mock.calls.map(([s]) => s.stage)).toEqual(["merging", "waiting", "downloading"]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/twistfit/jobs/job_1");
    expect(fetchMock.mock.calls[0][1]?.credentials).toBe("same-origin");
  });

  it("waits intervalMs between polls", async () => {
    const fetchMock = jobFetch([{ status: "running", stage: "waiting", elapsed_seconds: 0 }]);
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const promise = pollJob("job_1", { onUpdate: () => {}, signal: controller.signal, intervalMs: 1000 });
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("resolves with the error status (it does not throw)", async () => {
    vi.stubGlobal("fetch", jobFetch([{ status: "error", stage: "waiting", elapsed_seconds: 9, code: "flux_moderated" }]));
    const onUpdate = vi.fn();
    await expect(pollJob("job_1", { onUpdate, signal: new AbortController().signal })).resolves.toMatchObject({
      status: "error",
      code: "flux_moderated",
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("stops polling once the signal aborts", async () => {
    const fetchMock = jobFetch([{ status: "running", stage: "waiting", elapsed_seconds: 0 }]);
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const onUpdate = vi.fn();
    const promise = pollJob("job_1", { onUpdate, signal: controller.signal });
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(1500);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it("throws client_timeout after maxMs", async () => {
    const fetchMock = jobFetch([{ status: "running", stage: "waiting", elapsed_seconds: 0 }]);
    vi.stubGlobal("fetch", fetchMock);
    const promise = pollJob("job_1", { onUpdate: () => {}, signal: new AbortController().signal, maxMs: 5000 });
    const settled = promise.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(6000);
    const err = await settled;
    expect(err).toBeInstanceOf(TwistfitError);
    expect(err).toMatchObject({ code: "client_timeout" });
    const calls = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(calls);
  });

  it("defaults to a 120 s budget", async () => {
    vi.stubGlobal("fetch", jobFetch([{ status: "running", stage: "waiting", elapsed_seconds: 0 }]));
    const promise = pollJob("job_1", { onUpdate: () => {}, signal: new AbortController().signal });
    const settled = promise.catch((e: unknown) => e);
    let done = false;
    void settled.then(() => (done = true));
    await vi.advanceTimersByTimeAsync(118_000);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(await settled).toMatchObject({ code: "client_timeout" });
  });

  it("maps a 401 to invite_required", async () => {
    vi.stubGlobal("fetch", jobFetch([Response.json({ code: "invite_required" }, { status: 401 })]));
    await expect(pollJob("job_1", { onUpdate: () => {}, signal: new AbortController().signal })).rejects.toMatchObject({
      code: "invite_required",
      status: 401,
    });
  });

  it("throws on other HTTP errors (e.g. a job lost on restart)", async () => {
    vi.stubGlobal("fetch", jobFetch([Response.json({ code: "not_found" }, { status: 404 })]));
    await expect(pollJob("job_1", { onUpdate: () => {}, signal: new AbortController().signal })).rejects.toMatchObject({
      code: "not_found",
      status: 404,
    });
  });

  it("rides out a single network blip", async () => {
    let i = 0;
    const fetchMock = vi.fn(async () => {
      i += 1;
      if (i === 2) throw new TypeError("failed to fetch");
      return Response.json(
        i === 1
          ? { status: "running", stage: "waiting", elapsed_seconds: 0 }
          : { status: "done", stage: "downloading", elapsed_seconds: 3, result_id: "r1" },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const promise = pollJob("job_1", { onUpdate: () => {}, signal: new AbortController().signal });
    await vi.advanceTimersByTimeAsync(1500 * 3);
    await expect(promise).resolves.toMatchObject({ status: "done", result_id: "r1" });
  });

  it("gives up after repeated network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("failed to fetch");
      }),
    );
    const settled = pollJob("job_1", { onUpdate: () => {}, signal: new AbortController().signal }).catch(
      (e: unknown) => e,
    );
    await vi.advanceTimersByTimeAsync(1500 * 5);
    expect(await settled).toMatchObject({ code: "network" });
  });

  it("rejects a malformed status as invalid_response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: "weird" })));
    await expect(pollJob("job_1", { onUpdate: () => {}, signal: new AbortController().signal })).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
});
