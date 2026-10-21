import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { adminFrameHeaders } from "./frame-headers";

describe("admin frame protection", () => {
  it("covers /admin and /api/admin/* with DENY and frame-ancestors 'none'", () => {
    const sources = adminFrameHeaders.map((h) => h.source);
    expect(sources).toEqual(expect.arrayContaining(["/admin", "/api/admin/:path*"]));
    for (const rule of adminFrameHeaders) {
      expect(rule.headers).toEqual(
        expect.arrayContaining([
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ]),
      );
    }
  });

  it("is served by next.config headers() and keeps the standalone output", async () => {
    expect(nextConfig.output).toBe("standalone");
    expect(await nextConfig.headers?.()).toEqual(adminFrameHeaders);
  });
});
