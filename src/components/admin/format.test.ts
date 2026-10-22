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

  it("adds the model when it is a string", () => {
    expect(describeDetail({ garments: ["áo thun", "quần jeans"], model: "Minh Anh" })).toEqual({
      kind: "text",
      text: "Đồ đã chọn: áo thun, quần jeans · Người mẫu: Minh Anh",
    });
  });

  it("ignores a model that is not a string", () => {
    expect(describeDetail({ garments: ["áo thun"], model: 7 })).toEqual({
      kind: "text",
      text: "Đồ đã chọn: áo thun",
    });
  });

  it("does not treat an empty garments list as a selection", () => {
    const out = describeDetail({ garments: [], model: "Minh Anh" });
    expect(out.kind).toBe("text");
    expect(out.text.startsWith("{")).toBe(true);
  });

  it.each([
    ["flux_timeout", "Flux quá thời gian chờ"],
    ["flux_failed", "Flux báo lỗi"],
    ["flux_moderated", "Flux từ chối nội dung"],
    ["flux_unavailable", "Không gọi được Flux"],
    ["twistfit_limit", "Hết lượt Twistfit của link"],
    ["busy", "Đang bận"],
    ["concurrent_limit", "Đang bận"],
    ["global_concurrent_limit", "Đang bận"],
    ["cancelled", "Bị huỷ khi dịch vụ tắt"],
  ])("labels the Twistfit code %s", (code, label) => {
    expect(describeDetail({ code })).toEqual({ kind: "code", text: label });
  });

  it("shows an error code", () => {
    expect(describeDetail({ code: "stream_error" })).toEqual({ kind: "code", text: "stream_error" });
  });

  it("shows an inherited-property name as a code verbatim, not as a label lookup", () => {
    expect(describeDetail({ code: "constructor" })).toEqual({ kind: "code", text: "constructor" });
  });

  it("clips a very long garments list to the same length as other text", () => {
    const out = describeDetail({ garments: Array.from({ length: 200 }, (_, i) => `áo ${i}`) });
    expect(out.kind).toBe("text");
    expect(out.text.startsWith("Đồ đã chọn: áo 0, áo 1")).toBe(true);
    expect(out.text.length).toBeLessThanOrEqual(121);
    expect(out.text.endsWith("…")).toBe(true);
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
