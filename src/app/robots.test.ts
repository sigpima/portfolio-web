import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots.txt", () => {
  it("disallows the admin page, the API routes and invite links", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    expect(rules).toHaveLength(1);
    expect(rules[0].userAgent).toBe("*");
    expect(rules[0].allow).toBe("/");
    expect(rules[0].disallow).toEqual(["/admin", "/api/", "/i/"]);
  });
});
