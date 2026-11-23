// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "./route";

const KEY = "test-internal-key-0123456789abcdefghijklmnop";
const API = "http://api.test:8100";
const ADMIN = "admin_session_0123456789";

function get(query = "", cookie: string | null = `pf_admin=${ADMIN}`): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(`http://localhost/api/admin/links/3/feedback${query}`, { headers });
}
const ctx = (id = "3") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.stubEnv("PORTFOLIO_API_KEY", KEY);
  vi.stubEnv("PORTFOLIO_API_URL", API);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/admin/links/[id]/feedback", () => {
  it("is dynamic on node", () => {
    expect(route.dynamic).toBe("force-dynamic");
    expect(route.runtime).toBe("nodejs");
  });

  it("needs the admin cookie before anything else", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await route.GET(get("", null), ctx());
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["abc", "0x1", "1;2", "9".repeat(30)])("answers 422 for the id %s without calling the API", async (id) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await route.GET(get(), ctx(id))).status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["?limit=0", "?limit=201", "?limit=a", "?before=0", "?limit=1&limit=2"])("answers 422 for the query %s", async (query) => {
    vi.stubGlobal("fetch", vi.fn());
    expect((await route.GET(get(query), ctx())).status).toBe(422);
  });

  it("forwards the list with the admin session and a validated query", async () => {
    const rows = [{ id: 2, ts: "2026-10-22T09:00:00Z", message: "hai" }];
    const fetchMock = vi.fn(async () => Response.json(rows));
    vi.stubGlobal("fetch", fetchMock);
    const res = await route.GET(get("?limit=10&before=5"), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(rows);
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0][0]).toBe(`${API}/v1/admin/links/3/feedback?limit=10&before=5`);
    expect(new Headers(calls[0][1].headers).get("x-admin-session")).toBe(ADMIN);
  });

  it("answers 503 unavailable when the API answers something that is not a list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ not: "a list" })));
    expect((await route.GET(get(), ctx())).status).toBe(503);
  });
});
