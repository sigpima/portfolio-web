// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, clientKeyFrom, portfolioApiUrl } from "./portfolio-api";

const KEY = "test-internal-key-0123456789abcdefghijklmnop";

function hmac(value: string): string {
  return createHmac("sha256", KEY).update(value).digest("hex");
}

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/i/x", { headers });
}

beforeEach(() => {
  vi.stubEnv("PORTFOLIO_API_KEY", KEY);
  vi.stubEnv("PORTFOLIO_API_URL", "http://api.test:8100/");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("portfolioApiUrl", () => {
  it("strips trailing slashes", () => {
    expect(portfolioApiUrl()).toBe("http://api.test:8100");
  });

  it("defaults to the compose service", () => {
    vi.stubEnv("PORTFOLIO_API_URL", "");
    expect(portfolioApiUrl()).toBe("http://portfolio-api:8100");
  });
});

describe("apiFetch", () => {
  function mockFetch() {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response("{}"),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("adds the internal key and the explicit session headers, no-store", async () => {
    const fetchMock = mockFetch();
    await apiFetch("/v1/session", { session: "s1", adminSession: "a1", clientKey: "c1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test:8100/v1/session");
    const headers = new Headers(init?.headers);
    expect(headers.get("x-internal-key")).toBe(KEY);
    expect(headers.get("x-session")).toBe("s1");
    expect(headers.get("x-admin-session")).toBe("a1");
    expect(headers.get("x-client-key")).toBe("c1");
    expect(init?.cache).toBe("no-store");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    // the custom options must not leak into the fetch init
    expect(init).not.toHaveProperty("session");
    expect(init).not.toHaveProperty("adminSession");
    expect(init).not.toHaveProperty("clientKey");
  });

  it("omits empty optional headers", async () => {
    const fetchMock = mockFetch();
    await apiFetch("/v1/session", { session: "", clientKey: undefined });
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.has("x-session")).toBe(false);
    expect(headers.has("x-admin-session")).toBe(false);
    expect(headers.has("x-client-key")).toBe(false);
    expect(headers.get("x-internal-key")).toBe(KEY);
  });

  it("never forwards caller-supplied sensitive headers", async () => {
    const fetchMock = mockFetch();
    await apiFetch("/v1/invites/open", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-key": "forged",
        "x-session": "forged",
        "x-admin-session": "forged",
        "x-client-key": "forged",
        cookie: "pf_session=forged",
      },
      body: "{}",
    });
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-internal-key")).toBe(KEY);
    expect(headers.has("x-session")).toBe(false);
    expect(headers.has("x-admin-session")).toBe(false);
    expect(headers.has("x-client-key")).toBe(false);
    expect(headers.has("cookie")).toBe(false);
  });

  it("keeps a caller-provided signal", async () => {
    const fetchMock = mockFetch();
    const controller = new AbortController();
    await apiFetch("/v1/chat/stream", { signal: controller.signal });
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it("throws a clear error when PORTFOLIO_API_KEY is missing", async () => {
    const fetchMock = mockFetch();
    vi.stubEnv("PORTFOLIO_API_KEY", "");
    await expect(apiFetch("/v1/session")).rejects.toThrow(/PORTFOLIO_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["shorter than 32 characters", "a".repeat(31)],
    ["the CHANGE_ME placeholder", "CHANGE_ME"],
    ["containing a space", `${"a".repeat(20)} ${"b".repeat(20)}`],
    ["containing non-ASCII", `${"a".repeat(32)}é`],
    ["containing a control character", `${"a".repeat(32)}\u0001`],
  ])("fails closed with a clear error when PORTFOLIO_API_KEY is %s", async (_name, key) => {
    const fetchMock = mockFetch();
    vi.stubEnv("PORTFOLIO_API_KEY", key);
    const error = await apiFetch("/v1/session").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).toMatch(/PORTFOLIO_API_KEY is invalid.*32 visible ASCII/);
    // the error never echoes the key
    expect(String(error)).not.toContain(key);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a 32-character visible-ASCII key", async () => {
    const fetchMock = mockFetch();
    vi.stubEnv("PORTFOLIO_API_KEY", "x".repeat(32));
    await apiFetch("/v1/session");
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("x-internal-key")).toBe("x".repeat(32));
  });
});

describe("clientKeyFrom", () => {
  it("is a stable HMAC of the address that never contains the address", () => {
    const a = clientKeyFrom(req({ "x-real-ip": "203.0.113.7" }));
    const b = clientKeyFrom(req({ "x-real-ip": "203.0.113.7" }));
    expect(a).toBe(b);
    expect(a).toBe(hmac("203.0.113.7"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("203.0.113.7");
    expect(a).not.toBe(createHmac("sha256", "").update("203.0.113.7").digest("hex"));
  });

  it("differs for different addresses", () => {
    expect(clientKeyFrom(req({ "x-real-ip": "203.0.113.7" }))).not.toBe(
      clientKeyFrom(req({ "x-real-ip": "203.0.113.8" })),
    );
  });

  it("prefers x-real-ip over x-forwarded-for", () => {
    const key = clientKeyFrom(req({ "x-real-ip": "198.51.100.1", "x-forwarded-for": "198.51.100.2" }));
    expect(key).toBe(hmac("198.51.100.1"));
  });

  it("outside production, uses the LAST x-forwarded-for element (the first is client-controlled)", () => {
    const key = clientKeyFrom(req({ "x-forwarded-for": "1.1.1.1, 198.51.100.9" }));
    expect(key).toBe(hmac("198.51.100.9"));
    expect(key).not.toBe(hmac("1.1.1.1"));
  });

  it("groups IPv6 addresses by /64", () => {
    const a = clientKeyFrom(req({ "x-real-ip": "2001:db8:1:2::1" }));
    const b = clientKeyFrom(req({ "x-real-ip": "2001:0db8:0001:0002:ffff:eeee:dddd:cccc" }));
    const c = clientKeyFrom(req({ "x-real-ip": "2001:db8:1:3::1" }));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toContain("2001");
  });

  it("treats IPv4-mapped IPv6 as the IPv4 address", () => {
    expect(clientKeyFrom(req({ "x-real-ip": "::ffff:1.2.3.4" }))).toBe(
      clientKeyFrom(req({ "x-real-ip": "1.2.3.4" })),
    );
  });

  it("returns the literal 'unknown' when no address header is present", () => {
    expect(clientKeyFrom(req())).toBe("unknown");
  });

  it("does not warn outside production", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    clientKeyFrom(req());
    expect(error).not.toHaveBeenCalled();
  });

  it("in production trusts only X-Real-IP, never X-Forwarded-For", async () => {
    vi.resetModules();
    const fresh = await import("./portfolio-api");
    vi.stubEnv("NODE_ENV", "production");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(fresh.clientKeyFrom(req({ "x-real-ip": "198.51.100.1", "x-forwarded-for": "172.18.0.1" }))).toBe(
      hmac("198.51.100.1"),
    );
    // Next fills X-Forwarded-For with the socket peer (the Docker gateway): not a client address.
    expect(fresh.clientKeyFrom(req({ "x-forwarded-for": "172.18.0.1" }))).toBe("unknown");
    expect(fresh.clientKeyFrom(req({ "x-real-ip": "  ", "x-forwarded-for": "172.18.0.1" }))).toBe("unknown");
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toMatch(/X-Real-IP/);
  });

  it("warns exactly once in production when X-Real-IP is missing", async () => {
    vi.resetModules();
    const fresh = await import("./portfolio-api");
    vi.stubEnv("NODE_ENV", "production");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < 5; i += 1) expect(fresh.clientKeyFrom(req())).toBe("unknown");
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toMatch(/X-Real-IP/);
    expect(error.mock.calls[0]).toHaveLength(1);
  });
});
