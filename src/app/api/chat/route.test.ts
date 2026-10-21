// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import * as streamRoute from "./stream/route";
import * as statusRoute from "./status/route";

const KEY = "test-internal-key-0123456789abcdefghijklmnop";
const API = "http://api.test:8100";
const SESSION = "sess_SECRET_value_0123456789";
const MARKER = "UNIQUE_QUESTION_MARKER_7f3a91";
const BODY = `{"message":"${MARKER}","session_id":null}`;

let spies: MockInstance[] = [];

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

function mockFetch(impl: FetchImpl) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function chatRequest(
  body: BodyInit | null = BODY,
  init: { headers?: Record<string, string>; cookie?: string | null; signal?: AbortSignal } = {},
): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  for (const [k, v] of Object.entries(init.headers ?? {})) headers.set(k, v);
  const cookie = init.cookie === undefined ? `pf_session=${SESSION}` : init.cookie;
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest("http://localhost/api/chat/stream", {
    method: "POST",
    body,
    headers,
    signal: init.signal,
  });
}

function sseResponse(text = ""): Response {
  return new Response(text, { status: 200, headers: { "content-type": "text/event-stream" } });
}

beforeEach(() => {
  vi.stubEnv("PORTFOLIO_API_KEY", KEY);
  vi.stubEnv("PORTFOLIO_API_URL", API);
  spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
});

afterEach(() => {
  for (const spy of spies) {
    for (const args of spy.mock.calls) {
      const text = args.map(String).join(" ");
      expect(text).not.toContain(MARKER);
      expect(text).not.toContain(SESSION);
      expect(text).not.toContain(KEY);
    }
  }
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/chat/stream", () => {
  it("exports force-dynamic", () => {
    expect(streamRoute.dynamic).toBe("force-dynamic");
    expect(statusRoute.dynamic).toBe("force-dynamic");
  });

  it("answers 401 invite_required without a session cookie, without calling the API or reading the body", async () => {
    const fetchMock = mockFetch(async () => sseResponse());
    const req = chatRequest(BODY, { cookie: "other=1" });
    let bodyTouched = false;
    Object.defineProperty(req, "body", {
      get() {
        bodyTouched = true;
        return null;
      },
    });
    for (const method of ["text", "json", "arrayBuffer", "blob", "formData"] as const) {
      Object.defineProperty(req, method, {
        value: () => {
          bodyTouched = true;
          return Promise.reject(new Error("body read"));
        },
      });
    }
    const res = await streamRoute.POST(req);
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ code: "invite_required" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(bodyTouched).toBe(false);
  });

  it("treats an empty or malformed session cookie as no session", async () => {
    const fetchMock = mockFetch(async () => sseResponse());
    for (const cookie of ["pf_session=", "pf_session=a%20b", "pf_session=é"]) {
      const res = await streamRoute.POST(chatRequest(BODY, { cookie }));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ code: "invite_required" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the body to portfolio-api with the session and internal key", async () => {
    const fetchMock = mockFetch(async () => sseResponse());
    const body = '{"message":"hỏi \\u0000 é","session_id":null}';
    await streamRoute.POST(chatRequest(body));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/v1/chat/stream`);
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("x-session")).toBe(SESSION);
    expect(headers.get("x-internal-key")).toBe(KEY);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept")).toBe("text/event-stream");
    expect(Buffer.from(init?.body as Uint8Array).equals(Buffer.from(body, "utf8"))).toBe(true);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("forwards the body byte for byte, even when it is not valid UTF-8", async () => {
    const fetchMock = mockFetch(async () => sseResponse());
    const raw = new Uint8Array([0x7b, 0xff, 0xfe, 0xc3, 0x28, 0x7d]);
    await streamRoute.POST(chatRequest(raw as unknown as BodyInit));
    const sent = fetchMock.mock.calls[0][1]?.body as Uint8Array;
    expect(Buffer.from(sent).equals(Buffer.from(raw))).toBe(true);
  });

  it("does not forward browser headers; only the cookie value becomes the session", async () => {
    const fetchMock = mockFetch(async () => sseResponse());
    await streamRoute.POST(
      chatRequest(BODY, {
        headers: {
          "x-internal-key": "browser-chosen-key",
          "x-session": "browser-chosen-session",
          "x-admin-session": "browser-admin",
          "x-client-key": "browser-client",
          authorization: "Bearer browser",
          "x-forwarded-for": "6.6.6.6",
        },
        cookie: `pf_admin=admin_secret; pf_session=${SESSION}`,
      }),
    );
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("x-internal-key")).toBe(KEY);
    expect(headers.get("x-session")).toBe(SESSION);
    for (const name of ["cookie", "authorization", "x-admin-session", "x-client-key", "x-forwarded-for"]) {
      expect(headers.get(name)).toBeNull();
    }
    expect([...headers.values()].join(" ")).not.toContain("admin_secret");
  });

  it("streams the upstream body through untouched with the three SSE headers", async () => {
    const sse = 'event: start\ndata: {"session_id":"a"}\n\nevent: done\ndata: {"duration_ms":1}\n\n';
    mockFetch(async () => sseResponse(sse));
    const res = await streamRoute.POST(chatRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(res.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(res.headers.get("x-accel-buffering")).toBe("no");
    expect(await res.text()).toBe(sse);
  });

  it.each([
    [401, { code: "invite_required" }],
    [413, { code: "too_long" }],
    [415, { code: "unsupported_media_type" }],
    [422, { code: "invalid_question" }],
    [429, { code: "rate_limited" }],
    [503, { code: "demo_disabled" }],
  ])("passes through upstream %i with its JSON body", async (status, payload) => {
    mockFetch(async () => Response.json(payload, { status }));
    const res = await streamRoute.POST(chatRequest());
    expect(res.status).toBe(status);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual(payload);
  });

  it("relays only the code of an upstream error, never other fields (e.g. an echo of the question)", async () => {
    mockFetch(async () =>
      Response.json(
        { code: "invalid_question", detail: `echo ${MARKER}`, input: BODY, extra: { a: 1 } },
        { status: 422 },
      ),
    );
    const res = await streamRoute.POST(chatRequest());
    expect(res.status).toBe(422);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ code: "invalid_question" });
    expect(text).not.toContain(MARKER);
  });

  it.each([
    ["JSON", () => Response.json({ enabled: true }, { status: 200 })],
    ["HTML", () => new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } })],
    ["no content-type", () => new Response("x", { status: 200, headers: { "content-type": "" } })],
  ])("treats a 2xx that is not an event stream (%s) as 503 demo_disabled", async (_name, make) => {
    mockFetch(async () => make());
    const res = await streamRoute.POST(chatRequest());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "demo_disabled" });
  });

  it("maps an upstream 401 unauthorized (key mismatch) to 503 demo_disabled and logs exactly once", async () => {
    // Fresh module: the warn-once flag must not depend on which tests ran before.
    vi.resetModules();
    const fresh = await import("./stream/route");
    const fetchMock = mockFetch(async () => Response.json({ code: "unauthorized" }, { status: 401 }));
    for (let i = 0; i < 3; i++) {
      const res = await fresh.POST(chatRequest());
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ code: "demo_disabled" });
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const errors = spies[3]; // console.error (order: log, info, warn, error, debug)
    expect(errors.mock.calls).toHaveLength(1);
    expect(String(errors.mock.calls[0][0])).toMatch(/portfolio-api/i);
    expect(errors.mock.calls[0]).toHaveLength(1);
  });

  it.each([
    ["500 JSON", () => Response.json({ code: "internal" }, { status: 500 })],
    ["502 HTML", () => new Response("<html>bad gateway</html>", { status: 502 })],
    ["401 other code", () => Response.json({ code: "weird" }, { status: 401 })],
    ["401 garbage", () => new Response("nope", { status: 401 })],
    ["429 garbage", () => new Response("nope", { status: 429 })],
    ["404", () => Response.json({ code: "not_found" }, { status: 404 })],
    ["200 without body", () => new Response(null, { status: 204 })],
  ])("maps an unexpected upstream (%s) to 503 demo_disabled", async (_name, make) => {
    mockFetch(async () => make());
    const res = await streamRoute.POST(chatRequest());
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ code: "demo_disabled" });
  });

  it("returns 503 demo_disabled on a network error", async () => {
    mockFetch(async () => {
      throw new TypeError("fetch failed");
    });
    const res = await streamRoute.POST(chatRequest());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "demo_disabled" });
  });

  it("returns 503 demo_disabled when PORTFOLIO_API_KEY is missing", async () => {
    vi.stubEnv("PORTFOLIO_API_KEY", "");
    const fetchMock = mockFetch(async () => sseResponse());
    const res = await streamRoute.POST(chatRequest());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "demo_disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", ""])(
    "rejects content-type %j with 415 without contacting the API",
    async (contentType) => {
      const fetchMock = mockFetch(async () => sseResponse());
      const req = chatRequest(BODY, { headers: contentType ? { "content-type": contentType } : {} });
      if (!contentType) req.headers.delete("content-type");
      const res = await streamRoute.POST(req);
      expect(res.status).toBe(415);
      expect(await res.json()).toEqual({ code: "unsupported_media_type" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each(["application/json; charset=utf-8", "Application/JSON"])("accepts content-type %j", async (contentType) => {
    const fetchMock = mockFetch(async () => sseResponse());
    const res = await streamRoute.POST(chatRequest(BODY, { headers: { "content-type": contentType } }));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an oversized body with 413 without contacting the API", async () => {
    const fetchMock = mockFetch(async () => sseResponse());
    const res = await streamRoute.POST(chatRequest("x".repeat(33 * 1024)));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ code: "too_long" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enforces the cap when content-length is missing or understated", async () => {
    const fetchMock = mockFetch(async () => sseResponse());
    const big = new TextEncoder().encode("x".repeat(33 * 1024));
    const streamed = new NextRequest("http://localhost/api/chat/stream", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `pf_session=${SESSION}` },
      body: new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(big);
          c.close();
        },
      }),
      duplex: "half",
    } as unknown as ConstructorParameters<typeof NextRequest>[1]);
    expect(streamed.headers.get("content-length")).toBeNull();
    const lying = chatRequest("x".repeat(33 * 1024), { headers: { "content-length": "10" } });
    for (const req of [streamed, lying]) {
      const res = await streamRoute.POST(req);
      expect(res.status).toBe(413);
      expect(await res.json()).toEqual({ code: "too_long" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts the upstream request when the client aborts, even mid-stream", async () => {
    let upstreamSignal: AbortSignal | undefined;
    mockFetch(async (_url, init) => {
      upstreamSignal = init?.signal ?? undefined;
      return new Response(new ReadableStream({ start() {} }), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    });
    const ctrl = new AbortController();
    await streamRoute.POST(chatRequest(BODY, { signal: ctrl.signal }));
    expect(upstreamSignal?.aborted).toBe(false);
    ctrl.abort();
    expect(upstreamSignal?.aborted).toBe(true);
  });

  it("aborts an upstream whose headers never arrive after 15 s", async () => {
    vi.useFakeTimers();
    let upstreamSignal: AbortSignal | undefined;
    mockFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          upstreamSignal = init?.signal ?? undefined;
          upstreamSignal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const pending = streamRoute.POST(chatRequest());
    await vi.advanceTimersByTimeAsync(14_000);
    expect(upstreamSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(upstreamSignal?.aborted).toBe(true);
    const res = await pending;
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "demo_disabled" });
  });

  it("imposes no total timeout once the stream has started", async () => {
    vi.useFakeTimers();
    let upstreamSignal: AbortSignal | undefined;
    mockFetch(async (_url, init) => {
      upstreamSignal = init?.signal ?? undefined;
      return new Response(new ReadableStream({ start() {} }), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    });
    const res = await streamRoute.POST(chatRequest());
    expect(res.status).toBe(200);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(upstreamSignal?.aborted).toBe(false);
  });

  describe("upstream error body", () => {
    function hangingErrorBody() {
      const state = { signal: undefined as AbortSignal | undefined, cancelled: false };
      mockFetch(async (_url, init) => {
        state.signal = init?.signal ?? undefined;
        return new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(new TextEncoder().encode('{"code":'));
            },
            cancel() {
              state.cancelled = true;
            },
          }),
          { status: 503, headers: { "content-type": "application/json" } },
        );
      });
      return state;
    }

    it("is bounded by a 5 s timeout that aborts the upstream and answers 503 demo_disabled", async () => {
      vi.useFakeTimers();
      const state = hangingErrorBody();
      let settled = false;
      const pending = streamRoute.POST(chatRequest()).then((r) => ((settled = true), r));
      await vi.advanceTimersByTimeAsync(4_900);
      expect(settled).toBe(false);
      expect(state.signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(200);
      const res = await pending;
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ code: "demo_disabled" });
      expect(state.signal?.aborted).toBe(true);
      expect(state.cancelled).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("is abandoned when the client aborts: upstream aborted and the handler settles", async () => {
      vi.useFakeTimers();
      const state = hangingErrorBody();
      const ctrl = new AbortController();
      let settled = false;
      const pending = streamRoute.POST(chatRequest(BODY, { signal: ctrl.signal })).then((r) => ((settled = true), r));
      await vi.advanceTimersByTimeAsync(50);
      expect(settled).toBe(false);
      ctrl.abort();
      await vi.advanceTimersByTimeAsync(10);
      expect(settled).toBe(true);
      expect((await pending).status).toBe(503);
      expect(state.signal?.aborted).toBe(true);
      expect(state.cancelled).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("still passes a tiny error body through and leaves no timer behind", async () => {
      vi.useFakeTimers();
      mockFetch(async () => Response.json({ code: "rate_limited" }, { status: 429 }));
      const res = await streamRoute.POST(chatRequest());
      expect(res.status).toBe(429);
      expect(await res.json()).toEqual({ code: "rate_limited" });
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it("removes the client-abort listener when the client aborts before the headers arrive", async () => {
    vi.useFakeTimers();
    mockFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const ctrl = new AbortController();
    const req = chatRequest(BODY, { signal: ctrl.signal });
    const add = vi.spyOn(req.signal, "addEventListener");
    const remove = vi.spyOn(req.signal, "removeEventListener");
    const pending = streamRoute.POST(req);
    await vi.advanceTimersByTimeAsync(10);
    ctrl.abort();
    const res = await pending;
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "demo_disabled" });
    const added = add.mock.calls.filter(([type]) => type === "abort").map(([, fn]) => fn);
    const removed = remove.mock.calls.filter(([type]) => type === "abort").map(([, fn]) => fn);
    expect(added.length).toBeGreaterThan(0);
    for (const fn of added) expect(removed).toContain(fn);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("never logs the visitor's question, on success or on any failure path", async () => {
    const impls: FetchImpl[] = [
      async () => sseResponse("event: done\ndata: {}\n\n"),
      async () => Response.json({ code: "unauthorized" }, { status: 401 }),
      async () => new Response(`echo ${MARKER}`, { status: 500 }),
      async () => {
        throw new TypeError(`fetch failed ${"x"}`);
      },
    ];
    for (const impl of impls) {
      mockFetch(impl);
      const res = await streamRoute.POST(chatRequest());
      await res.text();
    }
    // afterEach asserts that no console.* call contains MARKER.
    expect(true).toBe(true);
  });
});

describe("GET /api/chat/status", () => {
  it("returns the API's JSON via portfolio-api with the internal key", async () => {
    const fetchMock = mockFetch(async () => Response.json({ enabled: true }));
    const res = await statusRoute.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ enabled: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/v1/chat/status`);
    expect(new Headers(init?.headers).get("x-internal-key")).toBe(KEY);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns enabled:false from the API as is", async () => {
    mockFetch(async () => Response.json({ enabled: false }));
    expect(await (await statusRoute.GET()).json()).toEqual({ enabled: false });
  });

  it("returns 200 enabled:false when the API is down", async () => {
    mockFetch(async () => {
      throw new TypeError("fetch failed");
    });
    const res = await statusRoute.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enabled: false });
  });

  it("returns 200 enabled:false when the key is missing", async () => {
    vi.stubEnv("PORTFOLIO_API_KEY", "");
    const fetchMock = mockFetch(async () => Response.json({ enabled: true }));
    expect(await (await statusRoute.GET()).json()).toEqual({ enabled: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["non-2xx", () => new Response("", { status: 500 })],
    ["401", () => Response.json({ code: "unauthorized" }, { status: 401 })],
    ["invalid JSON", () => new Response("not json", { status: 200 })],
    ["string enabled", () => Response.json({ enabled: "yes" })],
    ["missing enabled", () => Response.json({})],
    ["null body", () => Response.json(null)],
  ])("returns enabled:false on %s", async (_name, make) => {
    mockFetch(async () => make());
    const res = await statusRoute.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enabled: false });
  });
});
