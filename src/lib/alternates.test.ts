import { describe, expect, it, vi } from "vitest";
import { languageAlternates, resolveSiteUrl } from "./alternates";

describe("resolveSiteUrl", () => {
  it("uses SITE_URL when it is set, without warning", () => {
    const warn = vi.fn();
    const url = resolveSiteUrl({ SITE_URL: "https://example.com", NODE_ENV: "production" }, warn);
    expect(url.origin).toBe("https://example.com");
    expect(warn).not.toHaveBeenCalled();
  });

  it("falls back to localhost silently outside production", () => {
    const warn = vi.fn();
    expect(resolveSiteUrl({ NODE_ENV: "development" }, warn).href).toBe("http://localhost:3000/");
    expect(resolveSiteUrl({ NODE_ENV: "test" }, warn).href).toBe("http://localhost:3000/");
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns in production when SITE_URL is missing or blank, but does not throw", () => {
    const warn = vi.fn();
    expect(resolveSiteUrl({ NODE_ENV: "production" }, warn).href).toBe("http://localhost:3000/");
    expect(resolveSiteUrl({ NODE_ENV: "production", SITE_URL: "  " }, warn).href).toBe(
      "http://localhost:3000/",
    );
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain("SITE_URL");
  });

  it("throws in production only when REQUIRE_SITE_URL=1", () => {
    const warn = vi.fn();
    expect(() =>
      resolveSiteUrl({ NODE_ENV: "production", REQUIRE_SITE_URL: "1" }, warn),
    ).toThrow(/SITE_URL/);
    expect(() =>
      resolveSiteUrl({ NODE_ENV: "development", REQUIRE_SITE_URL: "1" }, warn),
    ).not.toThrow();
  });

  it("rejects a SITE_URL that is not an absolute URL", () => {
    expect(() => resolveSiteUrl({ SITE_URL: "example.com" }, vi.fn())).toThrow(/not a valid/);
  });
});

describe("languageAlternates", () => {
  it("builds canonical and hreflang paths", () => {
    const alt = languageAlternates("/projects", "vi");
    expect(alt?.canonical).toBe("/vi/projects");
    expect(alt?.languages).toMatchObject({ vi: "/vi/projects", en: "/en/projects" });
  });
});
