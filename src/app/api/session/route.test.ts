// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import * as route from "./route";

const KEY = "test-internal-key-0123456789abcdefghijklmnop";
const SESSION = "sess_SECRET_value_0123456789";
const NOT_INVITED = { invited: false, features: { chat: false, twistfit: false, gia_pha: false } };

let spies: MockInstance[] = [];

function call(cookie?: string) {
  const headers: Record<string, string> = cookie ? { cookie } : {};
  return route.GET(new NextRequest("http://localhost:3000/api/session", { headers }));
}

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("PORTFOLIO_API_KEY", KEY);
  vi.stubEnv("PORTFOLIO_API_URL", "http://api.test:8100");
  spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
});

afterEach(() => {
  for (const spy of spies) {
    for (const args of spy.mock.calls) expect(args.map(String).join(" ")).not.toContain(SESSION);
  }
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/session", () => {
  it("is dynamic", () => {
    expect(route.dynamic).toBe("force-dynamic");
  });

  it("returns the API's session state", async () => {
    const payload = { invited: true, features: { chat: true, twistfit: false, gia_pha: false } };
    const fetchMock = mockFetch(async () => Response.json(payload));
    const res = await call(`pf_session=${SESSION}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test:8100/v1/session");
    const headers = new Headers(init?.headers);
    expect(headers.get("x-session")).toBe(SESSION);
    expect(headers.get("x-internal-key")).toBe(KEY);
    expect(headers.has("cookie")).toBe(false);
  });

  it("drops unknown fields from the API reply", async () => {
    mockFetch(async () =>
      Response.json({ invited: true, extra: 1, features: { chat: true, twistfit: true, gia_pha: false, x: 1 } }),
    );
    expect(await (await call(`pf_session=${SESSION}`)).json()).toEqual({
      invited: true,
      features: { chat: true, twistfit: true, gia_pha: false },
    });
  });

  it("does not call the API without a cookie", async () => {
    const fetchMock = mockFetch(async () => Response.json({}));
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual(NOT_INVITED);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["non-2xx", async () => Response.json({ code: "unauthorized" }, { status: 401 })],
    ["invalid JSON", async () => new Response("not json", { status: 200 })],
    ["wrong shape", async () => Response.json({ invited: "yes", features: { chat: 1 } })],
    ["missing features", async () => Response.json({ invited: true })],
    [
      "network error",
      async () => {
        throw new TypeError("fetch failed");
      },
    ],
  ])("returns not invited (200) on %s", async (_name, impl) => {
    mockFetch(impl as (url: string) => Promise<Response>);
    const res = await call(`pf_session=${SESSION}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual(NOT_INVITED);
  });

  it("returns not invited when PORTFOLIO_API_KEY is missing", async () => {
    vi.stubEnv("PORTFOLIO_API_KEY", "");
    const fetchMock = mockFetch(async () => Response.json({}));
    const res = await call(`pf_session=${SESSION}`);
    expect(await res.json()).toEqual(NOT_INVITED);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
