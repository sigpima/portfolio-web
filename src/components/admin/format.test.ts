import { describe, expect, it } from "vitest";
import { describeDetail, endOfDayVn, formatVnTime, todayVn } from "./format";

describe("formatVnTime", () => {
  it("formats in Vietnam time as dd/MM HH:mm", () => {
    expect(formatVnTime("2026-10-21T02:12:00Z")).toBe("21/10 09:12");
    expect(formatVnTime("2026-10-21T20:05:00Z")).toBe("22/10 03:05");
  });

  it("shows a dash for missing or invalid values", () => {
    expect(formatVnTime(null)).toBe("—");
    expect(formatVnTime("not a date")).toBe("—");
  });
});

describe("endOfDayVn", () => {
  it("turns a plain date into the end of that day at UTC+7", () => {
    expect(endOfDayVn("2099-01-31")).toBe("2099-01-31T23:59:59+07:00");
  });
});

describe("todayVn", () => {
  it("is the calendar date in Vietnam", () => {
    // 2026-10-21T18:30Z is already the 22nd in Vietnam.
    expect(todayVn(new Date("2026-10-21T18:30:00Z"))).toBe("2026-10-22");
    expect(todayVn(new Date("2026-10-21T10:00:00Z"))).toBe("2026-10-21");
  });
});

describe("describeDetail", () => {
  it("lists garments", () => {
    expect(describeDetail({ garments: ["áo sơ mi trắng", "quần tây xám"] })).toEqual({
      kind: "text",
      text: "Đồ đã chọn: áo sơ mi trắng, quần tây xám",
    });
  });

  it("shows an error code", () => {
    expect(describeDetail({ code: "stream_error" })).toEqual({ kind: "code", text: "stream_error" });
  });

  it("clips other objects as JSON text", () => {
    const out = describeDetail({ other: "x".repeat(500) });
    expect(out.kind).toBe("text");
    expect(out.text.length).toBeLessThanOrEqual(121);
    expect(out.text.startsWith('{"other":')).toBe(true);
  });

  it("uses a dash for no detail", () => {
    expect(describeDetail(null)).toEqual({ kind: "none", text: "—" });
  });
});
