// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import * as route from "./route";

const KEY = "test-internal-key-0123456789abcdefghijklmnop";
const API = "http://api.test:8100";
const SESSION = "sess_SECRET_value_0123456789";
const MARKER = "UNIQUE_FEEDBACK_MARKER_55e1";
const BODY = JSON.stringify({ message: MARKER });

let spies: MockInstance[] = [];

function post(
  body: BodyInit | null = BODY,
  init: { headers?: Record<string, string>; cookie?: string | null } = {},
): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  for (const [k, v] of Object.entries(init.headers ?? {})) headers.set(k, v);
  const cookie = init.cookie === undefined ? `pf_session=${SESSION}` : init.cookie;
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest("http://localhost/api/feedback", { method: "POST", body, headers });
}

beforeEach(() => {
  vi.stubEnv("PORTFOLIO_API_KEY", KEY);
  vi.stubEnv("PORTFOLIO_API_URL", API);
  spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
});

afterEach(() => {
  // Neither the message nor a secret may ever reach a log.
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

describe("POST /api/feedback", () => {
  it("is dynamic on node", () => {
    expect(route.dynamic).toBe("force-dynamic");
    expect(route.runtime).toBe("nodejs");
  });

  it.each(["cross-site", "same-site", "none"])("answers 403 for sec-fetch-site: %s, before anything else", async (site) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await route.POST(post(BODY, { headers: { "sec-fetch-site": site }, cookie: null }));
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([null, "other=1", "pf_session=has space", `pf_session=${"x".repeat(600)}`])(
    "answers 401 invite_required without a usable session (%s), without calling the API",
    async (cookie) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const res = await route.POST(post(BODY, { cookie }));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ code: "invite_required" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("answers 415 for a body that is not JSON, and 413 beyond 8 KB, without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await route.POST(post(BODY, { headers: { "content-type": "text/plain" } }))).status).toBe(415);
    const big = await route.POST(post(JSON.stringify({ message: "a".repeat(9000) })));
    expect(big.status).toBe(413);
    expect(await big.json()).toEqual({ code: "too_long" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the message to portfolio-api with the internal key and the session taken from the cookie only", async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: 7 }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await route.POST(post(BODY, { headers: { "x-session": "forged", "x-internal-key": "forged" } }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("cache-control")).toBe("no-store");
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const [url, init] = calls[0];
    expect(url).toBe(`${API}/v1/feedback`);
    const headers = new Headers(init.headers);
    expect(headers.get("x-internal-key")).toBe(KEY);
    expect(headers.get("x-session")).toBe(SESSION);
    expect(new TextDecoder().decode(init.body as Uint8Array)).toBe(BODY);
  });

  it.each([
    [401, "invite_required"],
    [422, "invalid_request"],
    [429, "rate_limited"],
  ])("relays %s %s as {code}", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code, extra: "leak" }, { status })));
    const res = await route.POST(post());
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ code });
  });

  it.each([
    [404, "not_found"],
    [429, "invite_required"],
    [500, "error"],
    [503, "demo_disabled"],
  ])("turns an unexpected %s %s into 503 unavailable", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code }, { status })));
    const res = await route.POST(post());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "unavailable" });
  });

  it("answers 503 unavailable when the API is down or the internal key is rejected, and warns once about the key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }));
    expect((await route.POST(post())).status).toBe(503);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "unauthorized" }, { status: 401 })));
    const res = await route.POST(post());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "unavailable" });
  });
});
