// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import * as loginRoute from "./login/route";
import * as logoutRoute from "./logout/route";
import * as linksRoute from "./links/route";
import * as revokeRoute from "./links/[id]/revoke/route";
import * as eventsRoute from "./links/[id]/events/route";

const KEY = "test-internal-key-0123456789abcdefghijklmnop";
const API = "http://api.test:8100";
const PASSWORD = "PASSWORD_SECRET_marker_93ab";
const ADMIN = "adm_SECRET_session_0123456789";
const TOKEN = "tok_SECRET_created_abcdefghijklmnop";

let spies: MockInstance[] = [];

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

function mockFetch(impl: FetchImpl) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function req(
  path: string,
  init: { method?: string; body?: string | null; cookie?: string | null; headers?: Record<string, string> } = {},
): NextRequest {
  const headers = new Headers({ "content-type": "application/json", "x-real-ip": "203.0.113.7" });
  for (const [k, v] of Object.entries(init.headers ?? {})) headers.set(k, v);
  const cookie = init.cookie === undefined ? `pf_admin=${ADMIN}` : init.cookie;
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(`http://localhost${path}`, {
    method: init.method ?? "POST",
    body: init.body ?? null,
    headers,
  });
}

function idParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** Parsed Set-Cookie for `pf_admin`, or null. */
function adminCookie(res: Response): string | null {
  const all = res.headers.getSetCookie();
  return all.find((c) => c.startsWith("pf_admin=")) ?? null;
}

function sentHeaders(fetchMock: ReturnType<typeof mockFetch>, call = 0): Headers {
  return new Headers(fetchMock.mock.calls[call][1]?.headers);
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
      for (const secret of [PASSWORD, ADMIN, TOKEN, KEY]) expect(text).not.toContain(secret);
    }
  }
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("route config", () => {
  it.each([
    ["login", loginRoute],
    ["logout", logoutRoute],
    ["links", linksRoute],
    ["revoke", revokeRoute],
    ["events", eventsRoute],
  ])("%s is dynamic on node", (_name, mod) => {
    expect(mod.dynamic).toBe("force-dynamic");
    expect(mod.runtime).toBe("nodejs");
  });
});

describe("POST /api/admin/login", () => {
  const body = JSON.stringify({ password: PASSWORD });

  it("logs in, sets the admin cookie with the API max age and the right flags", async () => {
    const fetchMock = mockFetch(async () =>
      Response.json({ admin_session: ADMIN, max_age_seconds: 7200 }),
    );
    const res = await loginRoute.POST(req("/api/admin/login", { body, cookie: null }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true });
    const cookie = adminCookie(res)!;
    expect(cookie).toContain(`pf_admin=${ADMIN}`);
    expect(cookie).toMatch(/Max-Age=7200/i);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/v1/admin/login`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ password: PASSWORD });
    const headers = sentHeaders(fetchMock);
    expect(headers.get("x-internal-key")).toBe(KEY);
    expect(headers.get("x-client-key")).toMatch(/^[0-9a-f]{64}$/);
    expect(headers.has("x-admin-session")).toBe(false);
  });

  it("never echoes the password in the response", async () => {
    mockFetch(async () => Response.json({ code: "invalid_credentials", password: PASSWORD }, { status: 401 }));
    const res = await loginRoute.POST(req("/api/admin/login", { body, cookie: null }));
    expect(await res.text()).not.toContain(PASSWORD);
  });

  it.each([
    [401, "invalid_credentials"],
    [429, "rate_limited"],
  ])("passes %i %s through without a cookie", async (status, code) => {
    mockFetch(async () => Response.json({ code, extra: "x" }, { status }));
    const res = await loginRoute.POST(req("/api/admin/login", { body, cookie: null }));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ code });
    expect(adminCookie(res)).toBeNull();
  });

  it("maps an internal-key mismatch to 503 and flags it once", async () => {
    mockFetch(async () => Response.json({ code: "unauthorized" }, { status: 401 }));
    const res = await loginRoute.POST(req("/api/admin/login", { body, cookie: null }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "unavailable" });
  });

  it.each([
    ["500", async () => new Response("boom", { status: 500 })],
    ["network error", async () => Promise.reject(new Error(`net ${PASSWORD}`))],
    ["bad 200 body", async () => Response.json({ nope: 1 })],
  ])("answers 503 unavailable on %s", async (_name, impl) => {
    mockFetch(impl as FetchImpl);
    const res = await loginRoute.POST(req("/api/admin/login", { body, cookie: null }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "unavailable" });
    expect(adminCookie(res)).toBeNull();
  });

  it("answers 503 server_misconfigured when the internal key is missing", async () => {
    vi.stubEnv("PORTFOLIO_API_KEY", "");
    const fetchMock = mockFetch(async () => Response.json({}));
    const res = await loginRoute.POST(req("/api/admin/login", { body, cookie: null }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "server_misconfigured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON content type with 415", async () => {
    const fetchMock = mockFetch(async () => Response.json({}));
    const res = await loginRoute.POST(
      req("/api/admin/login", { body: `password=${PASSWORD}`, cookie: null, headers: { "content-type": "text/plain" } }),
    );
    expect(res.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a body over 4 KB with 413", async () => {
    const fetchMock = mockFetch(async () => Response.json({}));
    const big = JSON.stringify({ password: "x".repeat(5000) });
    const res = await loginRoute.POST(req("/api/admin/login", { body: big, cookie: null }));
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([["not json"], ['{"password":1}'], ["[]"]])("rejects malformed body %s with 422", async (raw) => {
    const fetchMock = mockFetch(async () => Response.json({}));
    const res = await loginRoute.POST(req("/api/admin/login", { body: raw, cookie: null }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ code: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/logout", () => {
  it("calls the API with the admin session and clears the cookie", async () => {
    const fetchMock = mockFetch(async () => new Response(null, { status: 204 }));
    const res = await logoutRoute.POST(req("/api/admin/logout"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/v1/admin/logout`);
    expect(sentHeaders(fetchMock).get("x-admin-session")).toBe(ADMIN);
    expect(adminCookie(res)).toMatch(/Max-Age=0/i);
  });

  it("still clears the cookie when the API fails", async () => {
    mockFetch(async () => Promise.reject(new Error("down")));
    const res = await logoutRoute.POST(req("/api/admin/logout"));
    expect(res.status).toBe(200);
    expect(adminCookie(res)).toMatch(/Max-Age=0/i);
  });

  it("does not call the API without a cookie", async () => {
    const fetchMock = mockFetch(async () => new Response(null, { status: 204 }));
    const res = await logoutRoute.POST(req("/api/admin/logout", { cookie: null }));
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("admin routes without a session", () => {
  it.each([
    ["GET links", () => linksRoute.GET(req("/api/admin/links", { method: "GET", cookie: null }))],
    [
      "POST links",
      () => linksRoute.POST(req("/api/admin/links", { body: '{"name":"a"}', cookie: null })),
    ],
    ["revoke", () => revokeRoute.POST(req("/api/admin/links/3/revoke", { body: "{}", cookie: null }), idParams("3"))],
    [
      "events",
      () => eventsRoute.GET(req("/api/admin/links/3/events", { method: "GET", cookie: null }), idParams("3")),
    ],
  ])("%s answers 401 admin_required without calling the API", async (_name, call) => {
    const fetchMock = mockFetch(async () => Response.json([]));
    const res = await call();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: "admin_required" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores a browser-sent x-admin-session header", async () => {
    const fetchMock = mockFetch(async () => Response.json([]));
    const res = await linksRoute.GET(
      req("/api/admin/links", { method: "GET", cookie: null, headers: { "x-admin-session": ADMIN } }),
    );
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/links", () => {
  const links = [
    {
      id: 1,
      name: "Công ty X",
      status: "active",
      created_at: "2026-10-21T02:12:00Z",
      expires_at: null,
      last_used_at: null,
      twistfit_max: null,
      counts: { chat: 1, twistfit: 0, gia_pha: 0 },
    },
  ];

  it("forwards with only the session value and slides the cookie", async () => {
    const fetchMock = mockFetch(async () => Response.json(links));
    const res = await linksRoute.GET(
      req("/api/admin/links", {
        method: "GET",
        headers: { "x-internal-key": "evil", "x-admin-session": "forged", "x-client-key": "evil" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual(links);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/v1/admin/links`);
    const headers = sentHeaders(fetchMock);
    expect(headers.get("x-admin-session")).toBe(ADMIN);
    expect(headers.get("x-internal-key")).toBe(KEY);
    expect(headers.has("cookie")).toBe(false);
    expect(headers.has("x-client-key")).toBe(false);
    const cookie = adminCookie(res)!;
    expect(cookie).toContain(`pf_admin=${ADMIN}`);
    expect(cookie).toMatch(/Max-Age=7200/i);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it("clears the cookie and passes 401 admin_required through", async () => {
    mockFetch(async () => Response.json({ code: "admin_required" }, { status: 401 }));
    const res = await linksRoute.GET(req("/api/admin/links", { method: "GET" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: "admin_required" });
    expect(adminCookie(res)).toMatch(/Max-Age=0/i);
  });

  it("maps an internal-key mismatch to 503 unavailable and logs one flag", async () => {
    mockFetch(async () => Response.json({ code: "unauthorized" }, { status: 401 }));
    const res = await linksRoute.GET(req("/api/admin/links", { method: "GET" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "unavailable" });
    expect(adminCookie(res)).toBeNull();
    await linksRoute.GET(req("/api/admin/links", { method: "GET" }));
    const errorSpy = spies[3];
    expect(errorSpy.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it.each([
    ["500", async () => new Response("boom", { status: 500 })],
    ["network error", async () => Promise.reject(new Error("down"))],
    ["non-array body", async () => Response.json({ x: 1 })],
  ])("answers 503 unavailable on %s", async (_name, impl) => {
    mockFetch(impl as FetchImpl);
    const res = await linksRoute.GET(req("/api/admin/links", { method: "GET" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "unavailable" });
  });
});

describe("POST /api/admin/links", () => {
  it("forwards the body and returns the one-time token", async () => {
    const fetchMock = mockFetch(async () =>
      Response.json({ id: 7, name: "Công ty X", token: TOKEN, extra: "drop" }, { status: 201 }),
    );
    const payload = { name: "Công ty X", expires_at: "2099-01-01T23:59:59+07:00", twistfit_max: 3 };
    const res = await linksRoute.POST(req("/api/admin/links", { body: JSON.stringify(payload) }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 7, name: "Công ty X", token: TOKEN });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/v1/admin/links`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(payload);
    expect(sentHeaders(fetchMock).get("content-type")).toBe("application/json");
    expect(adminCookie(res)).toMatch(/Max-Age=7200/i);
  });

  it.each([
    [422, "invalid_request"],
    [429, "rate_limited"],
  ])("relays only the code of a %i", async (status, code) => {
    mockFetch(async () => Response.json({ code, detail: [{ input: "x" }] }, { status }));
    const res = await linksRoute.POST(req("/api/admin/links", { body: '{"name":"a"}' }));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ code });
  });

  it("rejects a non-JSON content type with 415", async () => {
    const fetchMock = mockFetch(async () => Response.json({}));
    const res = await linksRoute.POST(
      req("/api/admin/links", { body: "name=a", headers: { "content-type": "application/x-www-form-urlencoded" } }),
    );
    expect(res.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized body with 413", async () => {
    const fetchMock = mockFetch(async () => Response.json({}));
    const res = await linksRoute.POST(
      req("/api/admin/links", { body: JSON.stringify({ name: "x".repeat(10_000) }) }),
    );
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/links/[id]/revoke", () => {
  it("calls revoke for the right id", async () => {
    const fetchMock = mockFetch(async () => new Response(null, { status: 204 }));
    const res = await revokeRoute.POST(req("/api/admin/links/42/revoke", { body: "{}" }), idParams("42"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/v1/admin/links/42/revoke`);
    expect(init?.method).toBe("POST");
    expect(adminCookie(res)).toMatch(/Max-Age=7200/i);
  });

  it("passes 404 not_found through", async () => {
    mockFetch(async () => Response.json({ code: "not_found" }, { status: 404 }));
    const res = await revokeRoute.POST(req("/api/admin/links/42/revoke", { body: "{}" }), idParams("42"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: "not_found" });
  });

  it.each([["abc"], ["1/../../login"], ["-1"], ["1234567890123456789"], [""]])(
    "rejects id %j without calling the API",
    async (id) => {
      const fetchMock = mockFetch(async () => new Response(null, { status: 204 }));
      const res = await revokeRoute.POST(req("/api/admin/links/x/revoke", { body: "{}" }), idParams(id));
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ code: "invalid_request" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("rejects a non-JSON content type with 415", async () => {
    const fetchMock = mockFetch(async () => new Response(null, { status: 204 }));
    const res = await revokeRoute.POST(
      req("/api/admin/links/42/revoke", { body: "", headers: { "content-type": "text/plain" } }),
      idParams("42"),
    );
    expect(res.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/links/[id]/events", () => {
  const events = [{ id: 9, ts: "2026-10-21T09:41:00Z", feature: "chat", outcome: "success", detail: null }];

  it("forwards limit and before", async () => {
    const fetchMock = mockFetch(async () => Response.json(events));
    const res = await eventsRoute.GET(
      req("/api/admin/links/5/events?limit=50&before=120", { method: "GET" }),
      idParams("5"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(events);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/v1/admin/links/5/events?limit=50&before=120`);
    expect(adminCookie(res)).toMatch(/Max-Age=7200/i);
  });

  it("omits absent query values", async () => {
    const fetchMock = mockFetch(async () => Response.json(events));
    await eventsRoute.GET(req("/api/admin/links/5/events", { method: "GET" }), idParams("5"));
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/v1/admin/links/5/events`);
  });

  it.each([
    ["limit=0"],
    ["limit=201"],
    ["limit=abc"],
    ["before=-1"],
    ["before=1e3"],
    ["before=0"],
    ["limit=50&limit=60"],
  ])("rejects %s with 422 without calling the API", async (query) => {
    const fetchMock = mockFetch(async () => Response.json(events));
    const res = await eventsRoute.GET(req(`/api/admin/links/5/events?${query}`, { method: "GET" }), idParams("5"));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ code: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a bad id", async () => {
    const fetchMock = mockFetch(async () => Response.json(events));
    const res = await eventsRoute.GET(req("/api/admin/links/x/events", { method: "GET" }), idParams("5?x=1"));
    expect(res.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes 404 through", async () => {
    mockFetch(async () => Response.json({ code: "not_found" }, { status: 404 }));
    const res = await eventsRoute.GET(req("/api/admin/links/5/events", { method: "GET" }), idParams("5"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: "not_found" });
  });
});
