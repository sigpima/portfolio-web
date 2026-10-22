// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "./route";

const KEY = "test-internal-key-0123456789abcdefghijklmnop";
const API = "http://api.test:8100";
const SESSION = "sess_SECRET_value_0123456789";

function get(cookie: string | null = `pf_session=${SESSION}`): NextRequest {
  return new NextRequest("http://localhost/api/twistfit/jobs/j1", {
    headers: cookie ? { cookie } : {},
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
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

describe("GET /api/twistfit/jobs/[id]", () => {
  it("is dynamic on node", () => {
    expect(route.dynamic).toBe("force-dynamic");
    expect(route.runtime).toBe("nodejs");
  });

  it.each([null, "pf_session=has space"])("answers 401 without a valid session (%s), even for a bad id", async (cookie) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await route.GET(get(cookie), ctx("../x"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: "invite_required" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["../x", "a/b", "a.b", "a b", "", "a".repeat(65), "%2e%2e"])(
    "answers 404 not_found without calling the API for id=%j",
    async (id) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const res = await route.GET(get(), ctx(id));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ code: "not_found" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("relays the job status as no-store JSON", async () => {
    const job = { status: "done", stage: "finished", elapsed_seconds: 12, result_id: "r_1" };
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => Response.json(job));
    vi.stubGlobal("fetch", fetchMock);
    const res = await route.GET(get(), ctx("job_ABC-123"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual(job);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/v1/twistfit/jobs/job_ABC-123`);
  });

  it("relays an unknown job as 404 not_found", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "not_found" }, { status: 404 })));
    const res = await route.GET(get(), ctx("gone"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: "not_found" });
  });
});
