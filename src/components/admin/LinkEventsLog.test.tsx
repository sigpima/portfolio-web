import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import LinkEventsLog from "./LinkEventsLog";
import type { AdminEvent } from "./types";

function events(fromId: number, count: number): AdminEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: fromId - i,
    ts: "2026-10-21T09:41:00Z",
    feature: "chat",
    outcome: "success",
    detail: null,
  }));
}

function mockPages(pages: AdminEvent[][]) {
  let n = 0;
  const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => Response.json(pages[n++] ?? []));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const LINK = { id: 5, name: "<b>Công ty X</b>" };

describe("LinkEventsLog", () => {
  it("shows the columns, Vietnamese labels and safe details", async () => {
    mockPages([
      [
        { id: 4, ts: "2026-10-21T09:41:00Z", feature: "twistfit", outcome: "success", detail: { garments: ["áo sơ mi trắng", "giày da nâu"] } },
        { id: 3, ts: "2026-10-21T09:36:00Z", feature: "twistfit", outcome: "error", detail: { code: "upstream_unavailable" } },
        { id: 2, ts: "2026-10-21T09:30:00Z", feature: "chat", outcome: "blocked", detail: { note: "<img src=x onerror=alert(1)>" } },
        { id: 1, ts: "2026-10-21T09:29:00Z", feature: "open", outcome: "success", detail: null },
      ],
    ]);
    const { container } = render(<LinkEventsLog link={LINK} onUnauthorized={vi.fn()} />);
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Lúc",
      "Tính năng",
      "Kết quả",
      "Chi tiết",
    ]);
    expect(screen.getByText("Đồ đã chọn: áo sơ mi trắng, giày da nâu")).toBeInTheDocument();
    expect(screen.getByText("upstream_unavailable")).toBeInTheDocument();
    expect(screen.getByText(/onerror=alert/)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Mở link")).toBeInTheDocument();
    expect(screen.getByText("Bot")).toBeInTheDocument();
    expect(screen.getAllByText("Twistfit")).toHaveLength(2);
    expect(screen.getAllByText("thành công")).toHaveLength(2);
    expect(screen.getByText("lỗi")).toBeInTheDocument();
    expect(screen.getByText("bị chặn")).toBeInTheDocument();
    expect(screen.getByText("21/10 16:41")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /<b>Công ty X<\/b>/ })).toBeInTheDocument();
    // a full page did not come back: nothing more to load
    expect(screen.queryByRole("button", { name: "Tải thêm" })).toBeNull();
  });

  it("loads more with the last id as before, and hides the button when done", async () => {
    const user = userEvent.setup();
    const fetchMock = mockPages([events(100, 50), events(50, 10)]);
    render(<LinkEventsLog link={LINK} onUnauthorized={vi.fn()} />);
    await screen.findAllByText("Bot");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/links/5/events?limit=50");
    await user.click(screen.getByRole("button", { name: "Tải thêm" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe("/api/admin/links/5/events?limit=50&before=51");
    await waitFor(() => expect(screen.getAllByText("Bot")).toHaveLength(60));
    expect(screen.queryByRole("button", { name: "Tải thêm" })).toBeNull();
  });

  it("shows an empty state", async () => {
    mockPages([[]]);
    render(<LinkEventsLog link={LINK} onUnauthorized={vi.fn()} />);
    expect(await screen.findByText("Link này chưa có hoạt động nào.")).toBeInTheDocument();
  });

  it("calls onUnauthorized on 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "admin_required" }, { status: 401 })));
    const onUnauthorized = vi.fn();
    render(<LinkEventsLog link={LINK} onUnauthorized={onUnauthorized} />);
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });

  it("shows an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "unavailable" }, { status: 503 })));
    render(<LinkEventsLog link={LINK} onUnauthorized={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được nhật ký");
  });
});
