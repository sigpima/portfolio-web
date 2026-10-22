import { describe, expect, it } from "vitest";
import { getProject } from "@/content/registry";
import { liveFeatureOf } from "./live-feature";

describe("liveFeatureOf", () => {
  it("is twistfit for the Twistfit project and chat for the Knowledge Base", () => {
    expect(liveFeatureOf(getProject("twistfit")!)).toBe("twistfit");
    expect(liveFeatureOf(getProject("knowledge-base")!)).toBe("chat");
  });

  it("defaults to chat for an unknown demo or no demo", () => {
    const kb = getProject("knowledge-base")!;
    expect(liveFeatureOf({ ...kb, demo: { component: "stub" } })).toBe("chat");
    expect(liveFeatureOf({ ...kb, demo: undefined })).toBe("chat");
  });
});
