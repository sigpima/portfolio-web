// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "./route";

const KEY = "test-internal-key-0123456789abcdefghijklmnop";
const API = "http://api.test:8100";
const SESSION = "sess_SECRET_value_0123456789";

function get(cookie: string | null = `pf_session=${SESSION}`): NextRequest {
  return new NextRequest("http://localhost/api/twistfit/catalog", {
    headers: cookie ? { cookie } : {},
  });
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

describe("GET /api/twistfit/catalog", () => {
  it("is dynamic on node", () => {
    expect(route.dynamic).toBe("force-dynamic");
    expect(route.runtime).toBe("nodejs");
  });

  it.each([null, "pf_session=has space", "other=1"])("answers 401 without a valid session (%s)", async (cookie) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await route.GET(get(cookie));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: "invite_required" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("relays the catalog as no-store JSON", async () => {
    const catalog = { models: [{ id: "m1", name: "An" }], items: [{ id: "i1", name: "Ao" }] };
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => Response.json(catalog));
    vi.stubGlobal("fetch", fetchMock);
    const res = await route.GET(get());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual(catalog);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/v1/twistfit/catalog`);
  });
});
