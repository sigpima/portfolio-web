import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import LoginForm from "./LoginForm";

const PASSWORD = "PASSWORD_SECRET_marker_93ab";
let spies: MockInstance[] = [];

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  refresh.mockReset();
  spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
});

afterEach(() => {
  for (const spy of spies) {
    for (const args of spy.mock.calls) expect(args.map(String).join(" ")).not.toContain(PASSWORD);
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function submit(password = PASSWORD) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Mật khẩu"), password);
  await user.click(screen.getByRole("button", { name: "Đăng nhập" }));
}

describe("LoginForm", () => {
  it("posts the password as JSON and calls onSuccess", async () => {
    const onSuccess = vi.fn();
    const fetchMock = mockFetch(async () => Response.json({ ok: true }));
    render(<LoginForm onSuccess={onSuccess} />);
    expect(screen.getByLabelText("Mật khẩu")).toHaveAttribute("type", "password");
    await submit();
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/login");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({ password: PASSWORD });
  });

  it("refreshes the page by default after logging in", async () => {
    mockFetch(async () => Response.json({ ok: true }));
    render(<LoginForm />);
    await submit();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows an error for a wrong password", async () => {
    mockFetch(async () => Response.json({ code: "invalid_credentials" }, { status: 401 }));
    render(<LoginForm onSuccess={vi.fn()} />);
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Mật khẩu không đúng");
  });

  it("asks to try again later when rate limited", async () => {
    mockFetch(async () => Response.json({ code: "rate_limited" }, { status: 429 }));
    render(<LoginForm onSuccess={vi.fn()} />);
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("thử lại sau");
  });

  it("shows a generic error when the server is unavailable", async () => {
    mockFetch(async () => Promise.reject(new Error("down")));
    render(<LoginForm onSuccess={vi.fn()} />);
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Không kết nối được");
  });

  it("disables the button while pending", async () => {
    let resolve: (r: Response) => void = () => {};
    mockFetch(() => new Promise<Response>((r) => (resolve = r)));
    render(<LoginForm onSuccess={vi.fn()} />);
    await submit();
    expect(screen.getByRole("button", { name: /Đang đăng nhập/ })).toBeDisabled();
    resolve(Response.json({ ok: true }));
  });

  it("does not submit an empty password", async () => {
    const fetchMock = mockFetch(async () => Response.json({ ok: true }));
    render(<LoginForm onSuccess={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
