// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { forwardTwistfit } from "./twistfit-proxy";

const KEY = "test-internal-key-0123456789abcdefghijklmnop";
const API = "http://api.test:8100";
const SESSION = "sess_SECRET_value_0123456789";
const BODY_MARKER = "UNIQUE_BODY_MARKER_55e1";

let spies: MockInstance[] = [];

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

function mockFetch(impl: FetchImpl) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function req(init: { method?: string; cookie?: string | null; headers?: Record<string, string> } = {}): NextRequest {
  const headers = new Headers(init.headers);
  const cookie = init.cookie === undefined ? `pf_session=${SESSION}` : init.cookie;
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest("http://localhost/api/twistfit/x", { method: init.method ?? "GET", headers });
}

function sentHeaders(fetchMock: ReturnType<typeof mockFetch>, call = 0): Headers {
  return new Headers(fetchMock.mock.calls[call][1]?.headers);
}

function apiError(code: string, status: number, extra: Record<string, unknown> = {}): Response {
  return Response.json({ code, ...extra }, { status });
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 255, 128, 1]);

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
      for (const secret of [KEY, SESSION, BODY_MARKER]) expect(text).not.toContain(secret);
    }
  }
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("forwardTwistfit session", () => {
  it.each([
    ["no cookie", null],
    ["another cookie only", "other=1"],
    ["empty session", "pf_session="],
    ["session with a space", "pf_session=a%20b"],
    ["session over 512 chars", `pf_session=${"a".repeat(513)}`],
  ])("answers 401 invite_required without calling the API (%s)", async (_name, cookie) => {
    const fetchMock = mockFetch(async () => Response.json({}));
    const res = await forwardTwistfit(req({ cookie }), "/v1/twistfit/catalog");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: "invite_required" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("forwardTwistfit JSON", () => {
  it("relays a JSON answer with no-store and sends the cookie as X-Session", async () => {
    const fetchMock = mockFetch(async () => Response.json({ models: [{ id: "m1" }], items: [] }));
    const res = await forwardTwistfit(req(), "/v1/twistfit/catalog");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ models: [{ id: "m1" }], items: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/v1/twistfit/catalog`);
    expect(init?.method).toBe("GET");
    const headers = sentHeaders(fetchMock);
    expect(headers.get("x-session")).toBe(SESSION);
    expect(headers.get("x-internal-key")).toBe(KEY);
  });

  it("never forwards x-session or x-internal-key sent by the browser", async () => {
    const fetchMock = mockFetch(async () => Response.json({ ok: 1 }));
    await forwardTwistfit(
      req({ headers: { "x-session": "forged-session", "x-internal-key": "forged-key", authorization: "Bearer x" } }),
      "/v1/twistfit/catalog",
    );
    const headers = sentHeaders(fetchMock);
    expect(headers.get("x-session")).toBe(SESSION);
    expect(headers.get("x-internal-key")).toBe(KEY);
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("cookie")).toBeNull();
  });

  it("forwards the POST body byte for byte and relays 202", async () => {
    const fetchMock = mockFetch(async () => Response.json({ job_id: "j_1" }, { status: 202 }));
    // Invalid UTF-8 on purpose: the proxy must not decode and re-encode the body.
    const body = new Uint8Array([...new TextEncoder().encode(`{"x":"${BODY_MARKER}"}`), 0xff, 0xfe]);
    const res = await forwardTwistfit(req({ method: "POST" }), "/v1/twistfit/run", { method: "POST", body });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ job_id: "j_1" });
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(new Uint8Array(init?.body as Uint8Array)).toEqual(body);
    expect(sentHeaders(fetchMock).get("content-type")).toBe("application/json");
  });

  it("does not leak extra headers or set-cookie from upstream", async () => {
    mockFetch(async () => Response.json({ a: 1 }, { headers: { "set-cookie": "x=1", "x-secret": "s" } }));
    const res = await forwardTwistfit(req(), "/v1/twistfit/catalog");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("x-secret")).toBeNull();
  });

  it.each([
    ["HTML", () => new Response("<html></html>", { headers: { "content-type": "text/html" } })],
    ["not an object", () => Response.json([1, 2])],
    ["malformed JSON", () => new Response("{nope", { headers: { "content-type": "application/json" } })],
    ["an image", () => new Response(PNG, { headers: { "content-type": "image/png" } })],
  ])("turns a 2xx that is %s into 503 demo_disabled", async (_name, make) => {
    mockFetch(async () => make());
    const res = await forwardTwistfit(req(), "/v1/twistfit/catalog");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "demo_disabled" });
  });
});

describe("forwardTwistfit binary", () => {
  it.each(["image/png", "image/jpeg", "image/webp", "IMAGE/PNG; charset=binary"])(
    "streams %s intact with a private cache header",
    async (type) => {
      mockFetch(async () => new Response(PNG, { headers: { "content-type": type, "cache-control": "public, max-age=9" } }));
      const res = await forwardTwistfit(req(), "/v1/twistfit/results/r1", { binary: true });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe(type.split(";")[0].trim().toLowerCase());
      expect(res.headers.get("cache-control")).toBe("private, max-age=3600");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
    },
  );

  it.each(["text/html", "image/svg+xml", "application/json", "application/octet-stream"])(
    "turns an upstream %s into 503 demo_disabled",
    async (type) => {
      mockFetch(async () => new Response("<svg onload=alert(1)>", { headers: { "content-type": type } }));
      const res = await forwardTwistfit(req(), "/v1/twistfit/assets/items/a", { binary: true });
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ code: "demo_disabled" });
      expect(res.headers.get("cache-control")).toBe("no-store");
    },
  );

  it("relays an upstream 404 not_found as no-store JSON", async () => {
    mockFetch(async () => apiError("not_found", 404));
    const res = await forwardTwistfit(req(), "/v1/twistfit/results/r1", { binary: true });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: "not_found" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("forwardTwistfit errors", () => {
  it.each([
    [401, "invite_required"],
    [404, "not_found"],
    [413, "too_long"],
    [422, "invalid_request"],
    [429, "twistfit_limit"],
    [429, "busy"],
    [503, "demo_disabled"],
  ])("relays upstream %i %s with only the code", async (status, code) => {
    mockFetch(async () => apiError(code, status, { detail: "SECRET_DETAIL", path: "/srv/x" }));
    const res = await forwardTwistfit(req(), "/v1/twistfit/jobs/j1");
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ code });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("maps an upstream `unauthorized` (internal key mismatch) to 503 demo_disabled and warns once", async () => {
    // Fresh module state: the one-time flag lives in admin-proxy, shared with the proxy.
    vi.resetModules();
    const { forwardTwistfit: freshForward } = await import("./twistfit-proxy");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch(async () => apiError("unauthorized", 401));
    for (let i = 0; i < 2; i++) {
      const res = await freshForward(req(), "/v1/twistfit/catalog");
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ code: "demo_disabled" });
    }
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const message = errorSpy.mock.calls[0].map(String).join(" ");
    expect(message).toContain("PORTFOLIO_API_KEY");
    expect(message).not.toContain(KEY);
    expect(message).not.toContain(SESSION);
  });

  it.each([
    ["unknown code on a known status", () => apiError("something_else", 429)],
    ["known code on an unknown status", () => apiError("busy", 418)],
    ["503 invite_required (mismatched pair)", () => apiError("invite_required", 503)],
    ["429 not_found (mismatched pair)", () => apiError("not_found", 429)],
    ["404 busy (mismatched pair)", () => apiError("busy", 404)],
    ["422 twistfit_limit (mismatched pair)", () => apiError("twistfit_limit", 422)],
    ["401 demo_disabled (mismatched pair)", () => apiError("demo_disabled", 401)],
    ["429 rate_limited (chat code, not a twistfit one)", () => apiError("rate_limited", 429)],
    ["a 500", () => apiError("internal", 500)],
    ["a 502 HTML page", () => new Response("<html>bad gateway</html>", { status: 502, headers: { "content-type": "text/html" } })],
    ["a 404 with a non-JSON body", () => new Response("nope", { status: 404 })],
    ["a 401 that is not invite_required", () => apiError("admin_required", 401)],
    ["a 429 with no code", () => Response.json({ detail: "x" }, { status: 429 })],
  ])("maps %s to 503 demo_disabled", async (_name, make) => {
    mockFetch(async () => make());
    const res = await forwardTwistfit(req(), "/v1/twistfit/jobs/j1");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "demo_disabled" });
  });

  it("maps a network failure to 503 demo_disabled", async () => {
    mockFetch(async () => {
      throw new TypeError("fetch failed");
    });
    const res = await forwardTwistfit(req(), "/v1/twistfit/catalog");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "demo_disabled" });
  });

  it("maps a missing internal key to 503 demo_disabled", async () => {
    vi.stubEnv("PORTFOLIO_API_KEY", "");
    const fetchMock = mockFetch(async () => Response.json({}));
    const res = await forwardTwistfit(req(), "/v1/twistfit/catalog");
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives upstream 15 seconds to send headers, then answers 503", async () => {
    vi.useFakeTimers();
    mockFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const pending = forwardTwistfit(req(), "/v1/twistfit/catalog");
    await vi.advanceTimersByTimeAsync(14_900);
    let settled = false;
    void pending.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    const res = await pending;
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "demo_disabled" });
  });

  it("aborts the upstream request when the client goes away", async () => {
    const abort = new AbortController();
    let upstreamSignal: AbortSignal | undefined;
    mockFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          upstreamSignal = init?.signal ?? undefined;
          upstreamSignal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const request = new NextRequest("http://localhost/api/twistfit/x", {
      headers: { cookie: `pf_session=${SESSION}` },
      signal: abort.signal,
    });
    const pending = forwardTwistfit(request, "/v1/twistfit/catalog");
    await Promise.resolve();
    abort.abort();
    const res = await pending;
    expect(upstreamSignal?.aborted).toBe(true);
    expect(res.status).toBe(503);
  });
});
