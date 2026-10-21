/** Formatting helpers of the admin page (Vietnam time, event details). */

export const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

const timeParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: VN_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: VN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? "";
}

/** `dd/MM HH:mm` in Vietnam time; "—" for a missing or unparsable value. */
export function formatVnTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const p = timeParts.formatToParts(date);
  return `${part(p, "day")}/${part(p, "month")} ${part(p, "hour")}:${part(p, "minute")}`;
}

/** Today's calendar date in Vietnam as `YYYY-MM-DD`. */
export function todayVn(now: Date = new Date()): string {
  const p = dateParts.formatToParts(now);
  return `${part(p, "year")}-${part(p, "month")}-${part(p, "day")}`;
}

/** A `<input type="date">` value -> the end of that day in Vietnam time, with its offset. */
export function endOfDayVn(date: string): string {
  return `${date}T23:59:59+07:00`;
}

const MAX_DETAIL_TEXT = 120;

export type DetailView = { kind: "none" | "text" | "code"; text: string };

/** How an event `detail` is shown: garments as a list, an error code as is, else clipped JSON. */
export function describeDetail(detail: unknown): DetailView {
  if (detail === null || detail === undefined) return { kind: "none", text: "—" };
  if (typeof detail === "object" && !Array.isArray(detail)) {
    const record = detail as Record<string, unknown>;
    if (Array.isArray(record.garments) && record.garments.length > 0) {
      return { kind: "text", text: `Đồ đã chọn: ${record.garments.map(String).join(", ")}` };
    }
    if (typeof record.code === "string") return { kind: "code", text: record.code };
  }
  let text: string;
  try {
    text = JSON.stringify(detail) ?? "—";
  } catch {
    text = "—";
  }
  if (text.length > MAX_DETAIL_TEXT) text = `${text.slice(0, MAX_DETAIL_TEXT)}…`;
  return { kind: "text", text };
}
