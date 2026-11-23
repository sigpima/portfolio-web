import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import LinkFeedback from "./LinkFeedback";
import type { AdminFeedback } from "./types";

function rows(fromId: number, count: number): AdminFeedback[] {
  return Array.from({ length: count }, (_, i) => ({ id: fromId - i, ts: "2026-10-21T09:41:00Z", message: `góp ý ${fromId - i}` }));
}

function mockPages(pages: AdminFeedback[][]) {
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

describe("LinkFeedback", () => {
  it("lists the messages as plain text with their Vietnam time, and the link name as text", async () => {
    mockPages([[{ id: 2, ts: "2026-10-21T09:41:00Z", message: "<img src=x onerror=alert(1)>\ndòng hai" }, ...rows(1, 1)]]);
    const { container } = render(<LinkFeedback link={LINK} onUnauthorized={vi.fn()} />);
    expect(await screen.findByText(/dòng hai/)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("<b>Công ty X</b>")).toBeInTheDocument();
    expect(container.textContent).toContain("16:41");
  });

  it("says plainly when a link has no feedback", async () => {
    mockPages([[]]);
    render(<LinkFeedback link={LINK} onUnauthorized={vi.fn()} />);
    expect(await screen.findByText("Link này chưa có góp ý nào.")).toBeInTheDocument();
  });

  it("requests the first page, then the next one from the last id on 'Tải thêm'", async () => {
    const fetchMock = mockPages([rows(100, 50), rows(50, 3)]);
    render(<LinkFeedback link={LINK} onUnauthorized={vi.fn()} />);
    await screen.findByText("góp ý 100");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/links/5/feedback?limit=50");
    await userEvent.click(screen.getByRole("button", { name: "Tải thêm" }));
    await screen.findByText("góp ý 50");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/admin/links/5/feedback?limit=50&before=51");
    expect(screen.queryByRole("button", { name: "Tải thêm" })).toBeNull();
  });

  it("calls onUnauthorized on a 401 and shows a retry on other failures", async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    const first = render(<LinkFeedback link={LINK} onUnauthorized={onUnauthorized} />);
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
    first.unmount();

    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 503 })));
    render(<LinkFeedback link={LINK} onUnauthorized={onUnauthorized} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được góp ý");
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });
});
