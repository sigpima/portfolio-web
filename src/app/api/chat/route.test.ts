// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import * as streamRoute from "./stream/route";
import * as statusRoute from "./status/route";

afterEach(() => {
  vi.unstubAllGlobals();
});

function chatRequest(body: string, init: RequestInit = {}): Request {
  return new Request("http://localhost/api/chat/stream", {
    method: "POST",
    body,
    headers: { "content-type": "text/plain" },
    ...init,
  });
}

describe("POST /api/chat/stream", () => {
  it("exports force-dynamic", () => {
    expect(streamRoute.dynamic).toBe("force-dynamic");
    expect(statusRoute.dynamic).toBe("force-dynamic");
  });

  it("streams the upstream body through with SSE headers", async () => {
    const sse = 'event: start\ndata: {"session_id":"a"}\n\nevent: done\ndata: {"duration_ms":1}\n\n';
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await streamRoute.POST(chatRequest('{"message":"hi","session_id":null}'));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(res.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(res.headers.get("x-accel-buffering")).toBe("no");
    expect(await res.text()).toBe(sse);
  });

  it("sends content-type application/json and the JSON body upstream", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response("", { status: 200, headers: { "content-type": "text/event-stream" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const body = '{"message":"hỏi","session_id":null}';
    await streamRoute.POST(chatRequest(body));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://chat:8003/chat/stream");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(typeof init?.body).toBe("string");
    expect(init?.body).toBe(body);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    [413, { code: "too_long" }],
    [415, { code: "unsupported_media_type" }],
    [422, { code: "invalid_question" }],
    [503, { code: "demo_disabled" }],
  ])("passes through upstream %i with its JSON body", async (status, payload) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(payload, { status })));
    const res = await streamRoute.POST(chatRequest('{"message":"x","session_id":null}'));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual(payload);
  });

  it("returns 503 demo_disabled when the upstream is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const res = await streamRoute.POST(chatRequest('{"message":"x","session_id":null}'));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "demo_disabled" });
  });

  it("rejects an oversized body with 413 without contacting upstream", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await streamRoute.POST(chatRequest("x".repeat(33 * 1024)));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ code: "too_long" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enforces the cap when content-length is missing or understated", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const big = new TextEncoder().encode("x".repeat(33 * 1024));
    const streamed = new Request("http://localhost/api/chat/stream", {
      method: "POST",
      body: new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(big);
          c.close();
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    expect(streamed.headers.get("content-length")).toBeNull();
    const lying = chatRequest("x".repeat(33 * 1024), { headers: { "content-length": "10" } });
    for (const req of [streamed, lying]) {
      const res = await streamRoute.POST(req);
      expect(res.status).toBe(413);
      expect(await res.json()).toEqual({ code: "too_long" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts the upstream request when the client aborts", async () => {
    let upstreamSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        upstreamSignal = init?.signal ?? undefined;
        return new Response(new ReadableStream({ start() {} }), {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }),
    );
    const ctrl = new AbortController();
    await streamRoute.POST(
      chatRequest('{"message":"x","session_id":null}', { signal: ctrl.signal }),
    );
    expect(upstreamSignal?.aborted).toBe(false);
    ctrl.abort();
    expect(upstreamSignal?.aborted).toBe(true);
  });
});

describe("GET /api/chat/status", () => {
  it("returns the upstream JSON", async () => {
    const fetchMock = vi.fn(async (_url: string) => Response.json({ enabled: true }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await statusRoute.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enabled: true });
    expect(fetchMock.mock.calls[0][0]).toBe("http://chat:8003/chat/status");
  });

  it("returns 200 enabled:false when the upstream is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const res = await statusRoute.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enabled: false });
  });

  it("returns 200 enabled:false on upstream non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    const res = await statusRoute.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enabled: false });
  });
});
