// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN_COOKIE, SESSION_COOKIE, sessionCookieOptions } from "./cookies";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cookies", () => {
  it("names the cookies", () => {
    expect(SESSION_COOKIE).toBe("pf_session");
    expect(ADMIN_COOKIE).toBe("pf_admin");
  });

  it("is httpOnly, lax, root path, not secure outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(sessionCookieOptions(60)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
      maxAge: 60,
    });
  });

  it("is secure in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieOptions(60).secure).toBe(true);
  });
});
