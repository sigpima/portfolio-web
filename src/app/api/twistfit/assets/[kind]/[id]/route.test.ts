// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "./route";

const KEY = "test-internal-key-0123456789abcdefghijklmnop";
const API = "http://api.test:8100";
const SESSION = "sess_SECRET_value_0123456789";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 255]);

function get(cookie: string | null = `pf_session=${SESSION}`): NextRequest {
  return new NextRequest("http://localhost/api/twistfit/assets/items/x", {
    headers: cookie ? { cookie } : {},
  });
}

function ctx(kind: string, id: string) {
  return { params: Promise.resolve({ kind, id }) };
}

beforeEach(() => {
  vi.stubEnv("PORTFOLIO_API_KEY", KEY);
  vi.stubEnv("PORTFOLIO_API_URL", API);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/twistfit/assets/[kind]/[id]", () => {
  it("is dynamic on node", () => {
    expect(route.dynamic).toBe("force-dynamic");
    expect(route.runtime).toBe("nodejs");
  });

  it("answers 401 without a session, before looking at the params, and never calls the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const [kind, id] of [["items", "a1"], ["bogus", "../x"]]) {
      const res = await route.GET(get(null), ctx(kind, id));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ code: "invite_required" });
    }
    const res = await route.GET(get("pf_session=has space"), ctx("items", "a1"));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["items", "../x"],
    ["items", "a/b"],
    ["items", "a%2Fb"],
    ["items", "a.b"],
    ["items", ""],
    ["items", "a".repeat(65)],
    ["models", "a b"],
    ["secrets", "a1"],
    ["Items", "a1"],
    ["", "a1"],
    ["items/..", "a1"],
  ])("answers 404 not_found without calling the API for kind=%j id=%j", async (kind, id) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await route.GET(get(), ctx(kind, id));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: "not_found" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["items", "models"])("streams the %s image intact with a private cache header", async (kind) => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response(JPEG, { headers: { "content-type": "image/jpeg" } }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await route.GET(get(), ctx(kind, "ao-dai_01"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/v1/twistfit/assets/${kind}/ao-dai_01`);
  });

  it("accepts a 64 character id", async () => {
    const id = "a".repeat(64);
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response(JPEG, { headers: { "content-type": "image/jpeg" } }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await route.GET(get(), ctx("items", id));
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/v1/twistfit/assets/items/${id}`);
  });

  it("answers 503 demo_disabled when upstream sends something that is not an image", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { headers: { "content-type": "text/html" } })));
    const res = await route.GET(get(), ctx("items", "a1"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "demo_disabled" });
  });
});
