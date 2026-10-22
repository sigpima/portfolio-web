// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import * as route from "./route";

const KEY = "test-internal-key-0123456789abcdefghijklmnop";
const API = "http://api.test:8100";
const SESSION = "sess_SECRET_value_0123456789";
const MARKER = "UNIQUE_BODY_MARKER_55e1";
const BODY = `{"items":["${MARKER}"],"model":"m1"}`;

let spies: MockInstance[] = [];

function post(
  body: BodyInit | null = BODY,
  init: { headers?: Record<string, string>; cookie?: string | null } = {},
): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  for (const [k, v] of Object.entries(init.headers ?? {})) headers.set(k, v);
  const cookie = init.cookie === undefined ? `pf_session=${SESSION}` : init.cookie;
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest("http://localhost/api/twistfit/run", { method: "POST", body, headers });
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
      for (const secret of [MARKER, SESSION, KEY]) expect(text).not.toContain(secret);
    }
  }
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/twistfit/run", () => {
  it("is dynamic on node", () => {
    expect(route.dynamic).toBe("force-dynamic");
    expect(route.runtime).toBe("nodejs");
  });

  it.each(["cross-site", "same-site", "none"])("answers 403 for sec-fetch-site: %s, before anything else", async (site) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await route.POST(post(BODY, { headers: { "sec-fetch-site": site }, cookie: null }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ code: "forbidden" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 401 invite_required without a session, without reading the body or calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const req = post(BODY, { cookie: "other=1" });
    let bodyTouched = false;
    Object.defineProperty(req, "body", {
      get() {
        bodyTouched = true;
        return null;
      },
    });
    const res = await route.POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: "invite_required" });
    expect(bodyTouched).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 401 for a malformed session cookie", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await route.POST(post(BODY, { cookie: "pf_session=has%20space" }));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", ""])(
    "answers 415 for content-type %j without calling the API",
    async (type) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const req = post(BODY);
      req.headers.set("content-type", type);
      const res = await route.POST(req);
      expect(res.status).toBe(415);
      expect(await res.json()).toEqual({ code: "unsupported_media_type" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("answers 413 too_long for a body over 4 KB, without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const big = JSON.stringify({ items: ["x".repeat(4 * 1024)], model: "m" });
    const res = await route.POST(post(big));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ code: "too_long" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("413s an oversized body even when content-length is absent or understated", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(3000)));
        controller.enqueue(new TextEncoder().encode("y".repeat(3000)));
        controller.close();
      },
    });
    const req = new NextRequest("http://localhost/api/twistfit/run", {
      method: "POST",
      body: stream,
      headers: { "content-type": "application/json", cookie: `pf_session=${SESSION}`, "content-length": "10" },
      duplex: "half",
    });
    const res = await route.POST(req);
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a body of exactly 4 KB", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({ job_id: "j" }, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await route.POST(post("x".repeat(4 * 1024)));
    expect(res.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("forwards the exact body bytes, answers 202 and never logs the body", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({ job_id: "job_1" }, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await route.POST(post(BODY));
    expect(res.status).toBe(202);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ job_id: "job_1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/v1/twistfit/run`);
    expect(init?.method).toBe("POST");
    expect(new TextDecoder().decode(init?.body as Uint8Array)).toBe(BODY);
    const headers = new Headers(init?.headers);
    expect(headers.get("x-session")).toBe(SESSION);
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("ignores x-session / x-internal-key headers from the browser", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({ job_id: "j" }, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    await route.POST(post(BODY, { headers: { "x-session": "forged", "x-internal-key": "forged" } }));
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("x-session")).toBe(SESSION);
    expect(headers.get("x-internal-key")).toBe(KEY);
  });

  it.each([
    [429, "busy"],
    [429, "twistfit_limit"],
    [422, "invalid_request"],
    [413, "too_long"],
    [401, "invite_required"],
    [503, "demo_disabled"],
  ])("relays upstream %i %s", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code }, { status })));
    const res = await route.POST(post(BODY));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ code });
  });
});
