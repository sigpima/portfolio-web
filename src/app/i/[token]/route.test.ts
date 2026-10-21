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
    expect(res.headers.get("location")).toBe("http://localhost:3000/?invite=ok");

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
    expect(res.headers.get("location")).toBe("https://example.com/?invite=ok");
  });

  it.each([["CHANGE_ME"], ["example.com"], ["javascript:alert(1)"]])(
    "ignores an unusable SITE_URL (%s) and uses the request origin",
    async (value) => {
      vi.stubEnv("SITE_URL", value);
      mockFetch(async () => Response.json({ session: "s", max_age_seconds: 60 }));
      const res = await call();
      expect(res.headers.get("location")).toBe("http://localhost:3000/?invite=ok");
    },
  );

  it("404 invalid_invite redirects to /?invite=invalid without a cookie", async () => {
    mockFetch(async () => Response.json({ code: "invalid_invite" }, { status: 404 }));
    const res = await call();
    expectCommonHeaders(res);
    expect(res.headers.get("location")).toBe("http://localhost:3000/?invite=invalid");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it.each([
    ["429 rate_limited", 429, { code: "rate_limited" }],
    ["401 unauthorized (key mismatch)", 401, { code: "unauthorized" }],
    ["500", 500, {}],
    ["502", 502, {}],
    ["503", 503, {}],
    ["403", 403, {}],
    ["201", 201, { session: "s", max_age_seconds: 60 }],
  ])("%s redirects to /?invite=unavailable without a cookie", async (_name, status, body) => {
    mockFetch(async () => Response.json(body, { status }));
    const res = await call();
    expectCommonHeaders(res);
    expect(res.headers.get("location")).toBe("http://localhost:3000/?invite=unavailable");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("treats a network error as unavailable (not as a dead link)", async () => {
    mockFetch(async () => {
      throw new TypeError(`fetch failed for ${TOKEN}`);
    });
    const res = await call();
    expectCommonHeaders(res);
    expect(res.headers.get("location")).toBe("http://localhost:3000/?invite=unavailable");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("treats a malformed 200 reply as unavailable", async () => {
    mockFetch(async () => Response.json({ session: "", max_age_seconds: "x" }));
    const res = await call();
    expect(res.headers.get("location")).toBe("http://localhost:3000/?invite=unavailable");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it.each([
    ["missing", ""],
    ["too short", "short-key"],
    ["CHANGE_ME", "CHANGE_ME"],
  ])("fails closed as unavailable when PORTFOLIO_API_KEY is %s", async (_name, key) => {
    vi.stubEnv("PORTFOLIO_API_KEY", key);
    const fetchMock = mockFetch(async () => Response.json({ session: "s", max_age_seconds: 60 }));
    const res = await call();
    expect(res.headers.get("location")).toBe("http://localhost:3000/?invite=unavailable");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["empty", ""],
    ["too long", "a".repeat(513)],
    ["malformed", "abc def"],
    ["malformed (slash)", "a/../b"],
    ["malformed (non-ASCII)", "mã-mời"],
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

describe("link previewers and HEAD requests", () => {
  const BOT_UAS = [
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "Slack-ImgProxy (+https://api.slack.com/robots)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0",
    "Twitterbot/1.0",
    "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
    "WhatsApp/2.23.20.0",
    "TelegramBot (like TwitterBot)",
    "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    "Zalo/1.0 (+https://zalo.me)",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) SkypeUriPreview Preview/0.5",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 MicrosoftPreview/2.0",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; Google-InspectionTool/1.0)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/534+ (KHTML, like Gecko) BingPreview/1.0b",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1)",
    "Pinterestbot/1.0 (+http://www.pinterest.com/bot.html)",
    "Pinterest/0.2 (+https://www.pinterest.com/bot.html)",
    "Mozilla/5.0 (compatible; Embedly/0.2; +http://support.embed.ly/)",
    "http.rb/5.1.1 (Mastodon/4.2.0; +https://mastodon.social/)",
    "Signal-Desktop/6.40.0",
    "Mozilla/5.0 (compatible; redditbot/1.0; +http://www.reddit.com/feedback)",
    "Mozilla/5.0 (compatible; vkShare; +http://vk.com/dev/Share)",
    "Quora Link Preview/1.0 (http://www.quora.com)",
    "Mozilla/5.0 (Java) outbrain",
    "Tumblr/14.0.835.186",
    "Mozilla/5.0 (compatible; line-poker/1.0)",
    "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
    "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)",
    "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)",
    "curl/8.5.0",
    "Wget/1.21.4",
    "python-requests/2.31.0",
    "Go-http-client/2.0",
  ];

  const HUMAN_UAS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
    // Zalo's in-app browser is a person, not the previewer.
    "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 Zalo android/12100607 ZaloTheme/light ZaloLanguage/vi",
  ];

  async function expectNeutralPage(res: Response, fetchMock: ReturnType<typeof mockFetch>, withBody = true) {
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/html/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    if (withBody) {
      const html = await res.text();
      expect(html).toContain('<meta name="robots" content="noindex,nofollow">');
      expect(html).toContain("Trang này cần liên kết mời hợp lệ");
      expect(html).toContain("This page needs a valid invite link");
      expect(html).not.toMatch(/og:|twitter:/i);
      expect(html).not.toContain(TOKEN);
    }
  }

  it.each(BOT_UAS)("does not exchange the token for %s", async (ua) => {
    const fetchMock = mockFetch(async () => Response.json({ session: "s", max_age_seconds: 60 }));
    const res = await call(TOKEN, { "x-real-ip": "203.0.113.7", "user-agent": ua });
    await expectNeutralPage(res, fetchMock);
  });

  it.each(HUMAN_UAS)("still exchanges the token for a browser: %s", async (ua) => {
    const fetchMock = mockFetch(async () => Response.json({ session: "s", max_age_seconds: 60 }));
    const res = await call(TOKEN, { "x-real-ip": "203.0.113.7", "user-agent": ua });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/?invite=ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("exchanges the token when there is no User-Agent", async () => {
    const fetchMock = mockFetch(async () => Response.json({ session: "s", max_age_seconds: 60 }));
    const res = await call(TOKEN, { "x-real-ip": "203.0.113.7" });
    expect(res.headers.get("location")).toBe("http://localhost:3000/?invite=ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("answers HEAD with the neutral page headers, without calling the API", async () => {
    const fetchMock = mockFetch(async () => Response.json({ session: "s", max_age_seconds: 60 }));
    const res = await route.HEAD();
    await expectNeutralPage(res, fetchMock, false);
    expect(await res.text()).toBe("");
  });

  it("exports the bot list as one constant", async () => {
    const { PREVIEW_BOT_PATTERNS, isPreviewBot } = await import("@/lib/server/preview-bots");
    expect(PREVIEW_BOT_PATTERNS.length).toBeGreaterThan(20);
    expect(isPreviewBot(null)).toBe(false);
    expect(isPreviewBot("")).toBe(false);
    expect(PREVIEW_BOT_PATTERNS.join(" ")).not.toMatch(/headless/i);
  });
});
