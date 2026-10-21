import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import LinksDashboard from "./LinksDashboard";
import type { AdminLink } from "./types";

const LINKS: AdminLink[] = [
  {
    id: 1,
    name: "Công ty X",
    status: "active",
    created_at: "2026-10-21T02:12:00Z",
    expires_at: null,
    last_used_at: null,
    twistfit_max: null,
    counts: { chat: 1, twistfit: 0, gia_pha: 0 },
  },
];

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function mockRoutes(handler: Handler) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => handler(url, init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("LinksDashboard", () => {
  it("loads the links and shows the log of a selected row", async () => {
    const user = userEvent.setup();
    const fetchMock = mockRoutes((url) =>
      url === "/api/admin/links" ? Response.json(LINKS) : Response.json([]),
    );
    render(<LinksDashboard siteUrl="https://example.test" />);
    expect(await screen.findByRole("button", { name: "Công ty X" })).toBeInTheDocument();
    expect(screen.getByText(/Không ghi: nội dung câu hỏi/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Công ty X" }));
    expect(await screen.findByText("Link này chưa có hoạt động nào.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => String(u).startsWith("/api/admin/links/1/events"))).toBe(true);
  });

  it("switches to the login form on 401", async () => {
    mockRoutes(() => Response.json({ code: "admin_required" }, { status: 401 }));
    render(<LinksDashboard siteUrl="" />);
    expect(await screen.findByLabelText("Mật khẩu")).toBeInTheDocument();
  });

  it("revokes after confirmation and reloads the list", async () => {
    const user = userEvent.setup();
    let revoked = false;
    const fetchMock = mockRoutes((url, init) => {
      if (url === "/api/admin/links/1/revoke" && init?.method === "POST") {
        revoked = true;
        return Response.json({ ok: true });
      }
      if (url === "/api/admin/links") {
        return Response.json([{ ...LINKS[0], status: revoked ? "revoked" : "active" }]);
      }
      return Response.json([]);
    });
    render(<LinksDashboard siteUrl="https://example.test" />);
    const r = (await screen.findByRole("button", { name: "Công ty X" })).closest("tr")!;
    await user.click(within(r).getByRole("button", { name: /Thu hồi/ }));
    await user.click(within(r).getByRole("button", { name: /Xác nhận thu hồi/ }));
    expect(await screen.findByText("Đã thu hồi")).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([u]) => u === "/api/admin/links")).toHaveLength(2);
  });

  it("logs out and shows the login form", async () => {
    const user = userEvent.setup();
    const fetchMock = mockRoutes((url) => {
      if (url === "/api/admin/logout") return Response.json({ ok: true });
      return Response.json(LINKS);
    });
    render(<LinksDashboard siteUrl="" />);
    await screen.findByRole("button", { name: "Công ty X" });
    await user.click(screen.getByRole("button", { name: "Đăng xuất" }));
    expect(await screen.findByLabelText("Mật khẩu")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => u === "/api/admin/logout")).toBe(true));
  });

  it("shows an error with a retry when the list fails", async () => {
    mockRoutes(() => Response.json({ code: "unavailable" }, { status: 503 }));
    render(<LinksDashboard siteUrl="" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được danh sách link");
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    mockRoutes(() => Response.json([]));
    render(<LinksDashboard siteUrl="" />);
    expect(await screen.findByText(/Chưa có link nào/)).toBeInTheDocument();
  });
});
