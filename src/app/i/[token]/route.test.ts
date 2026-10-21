// @vitest-environment node
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import * as route from "./route";

const KEY = "test-internal-key-0123456789abcdefghijklmnop";
const TOKEN = "tok_SECRET_abcdefghijklmnopqrstuvwxyz0123456";

let spies: MockInstance[] = [];

function call(token: string = TOKEN, headers: Record<string, string> = { "x-real-ip": "203.0.113.7" }) {
  const request = new NextRequest(`http://localhost:3000/i/${encodeURIComponent(token)}`, { headers });
  return route.GET(request, { params: Promise.resolve({ token }) });
}

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function expectNoTokenInConsole() {
  for (const spy of spies) {
    for (const args of spy.mock.calls) {
      expect(args.map(String).join(" ")).not.toContain(TOKEN);
    }
  }
}

function expectCommonHeaders(res: Response) {
  expect(res.status).toBe(307);
  expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(res.headers.get("location") ?? "").not.toContain(TOKEN);
}

beforeEach(() => {
  vi.stubEnv("PORTFOLIO_API_KEY", KEY);
  vi.stubEnv("PORTFOLIO_API_URL", "http://api.test:8100");
  vi.stubEnv("SITE_URL", "");
  spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
});

afterEach(() => {
  expectNoTokenInConsole();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /i/[token]", () => {
  it("is dynamic", () => {
    expect(route.dynamic).toBe("force-dynamic");
  });

  it("opens the invite, sets pf_session and redirects to /", async () => {
    const fetchMock = mockFetch(async () =>
      Response.json({ session: "sess_value_123", max_age_seconds: 2592000 }),
    );
    const res = await call();
    expectCommonHeaders(res);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test:8100/v1/invites/open");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ token: TOKEN });
    const headers = new Headers(init?.headers);
    expect(headers.get("x-internal-key")).toBe(KEY);
    expect(headers.get("x-client-key")).toBe(
      createHmac("sha256", KEY).update("203.0.113.7").digest("hex"),
    );
    expect(headers.get("content-type")).toBe("application/json");

    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^pf_session=sess_value_123;/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=2592000/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).not.toMatch(/Secure/i);
  });

  it("marks the cookie Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockFetch(async () => Response.json({ session: "s", max_age_seconds: 60 }));
    const res = await call();
    expect(res.headers.get("set-cookie")).toMatch(/Secure/);
  });

  it("builds the Location from SITE_URL when set", async () => {
    vi.stubEnv("SITE_URL", "https://example.com/");
    mockFetch(async () => Response.json({ session: "s", max_age_seconds: 60 }));
    const res = await call();
    expect(res.headers.get("location")).toBe("https://example.com/");
  });

  it.each([
    ["404 invalid_invite", 404, { code: "invalid_invite" }],
    ["429 rate_limited", 429, { code: "rate_limited" }],
    ["401 unauthorized", 401, { code: "unauthorized" }],
    ["500", 500, {}],
  ])("%s redirects to /?invite=invalid without a cookie", async (_name, status, body) => {
    mockFetch(async () => Response.json(body, { status }));
    const res = await call();
    expectCommonHeaders(res);
    expect(res.headers.get("location")).toBe("http://localhost:3000/?invite=invalid");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("treats a network error like an invalid invite", async () => {
    mockFetch(async () => {
      throw new TypeError(`fetch failed for ${TOKEN}`);
    });
    const res = await call();
    expectCommonHeaders(res);
    expect(res.headers.get("location")).toBe("http://localhost:3000/?invite=invalid");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("treats a malformed 200 reply as invalid", async () => {
    mockFetch(async () => Response.json({ session: "", max_age_seconds: "x" }));
    const res = await call();
    expect(res.headers.get("location")).toBe("http://localhost:3000/?invite=invalid");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("fails closed when PORTFOLIO_API_KEY is missing", async () => {
    vi.stubEnv("PORTFOLIO_API_KEY", "");
    const fetchMock = mockFetch(async () => Response.json({ session: "s", max_age_seconds: 60 }));
    const res = await call();
    expect(res.headers.get("location")).toBe("http://localhost:3000/?invite=invalid");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["empty", ""],
    ["too long", "a".repeat(513)],
  ])("rejects an %s token without calling the API", async (_name, token) => {
    const fetchMock = mockFetch(async () => Response.json({ session: "s", max_age_seconds: 60 }));
    const res = await call(token);
    expectCommonHeaders(res);
    expect(res.headers.get("location")).toBe("http://localhost:3000/?invite=invalid");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a 512-character token", async () => {
    const fetchMock = mockFetch(async () => Response.json({ code: "invalid_invite" }, { status: 404 }));
    await call("b".repeat(512));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
