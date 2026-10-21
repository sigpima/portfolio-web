import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import CreateLinkForm from "./CreateLinkForm";

const TOKEN_A = "tokSECRETaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TOKEN_B = "tokSECRETbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SITE = "https://example.test";
let spies: MockInstance[] = [];

function mockCreate(tokens: string[]) {
  let n = 0;
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    return Response.json({ id: ++n, name: body.name, token: tokens[n - 1] }, { status: 201 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function bodyOf(fetchMock: ReturnType<typeof mockCreate>, call = 0) {
  return JSON.parse(String(fetchMock.mock.calls[call][1]?.body));
}

beforeEach(() => {
  spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
});

afterEach(() => {
  for (const spy of spies) {
    for (const args of spy.mock.calls) {
      const text = args.map(String).join(" ");
      expect(text).not.toContain(TOKEN_A);
      expect(text).not.toContain(TOKEN_B);
    }
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("CreateLinkForm", () => {
  it("uses a date input with a note about the end of day in Vietnam time", () => {
    render(<CreateLinkForm siteUrl={SITE} onCreated={vi.fn()} onUnauthorized={vi.fn()} />);
    const date = screen.getByLabelText(/Hết hạn/);
    expect(date).toHaveAttribute("type", "date");
    expect(screen.getByText("Hết hạn vào cuối ngày này, giờ Việt Nam (UTC+7)")).toBeInTheDocument();
    expect(screen.getByLabelText(/Tên link/)).toHaveAttribute("maxLength", "80");
  });

  it("sends the trimmed name, end-of-day expiry at +07:00 and the Twistfit cap", async () => {
    const user = userEvent.setup();
    const fetchMock = mockCreate([TOKEN_A]);
    const onCreated = vi.fn();
    render(<CreateLinkForm siteUrl={SITE} onCreated={onCreated} onUnauthorized={vi.fn()} />);
    await user.type(screen.getByLabelText(/Tên link/), "  Công ty X  ");
    await user.type(screen.getByLabelText(/Hết hạn/), "2099-01-31");
    await user.type(screen.getByLabelText(/Twistfit/), "3");
    await user.click(screen.getByRole("button", { name: "Tạo link" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/links");
    expect(bodyOf(fetchMock)).toEqual({
      name: "Công ty X",
      expires_at: "2099-01-31T23:59:59+07:00",
      twistfit_max: 3,
    });
  });

  it("omits the optional fields when empty", async () => {
    const user = userEvent.setup();
    const fetchMock = mockCreate([TOKEN_A]);
    render(<CreateLinkForm siteUrl={SITE} onCreated={vi.fn()} onUnauthorized={vi.fn()} />);
    await user.type(screen.getByLabelText(/Tên link/), "A");
    await user.click(screen.getByRole("button", { name: "Tạo link" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(bodyOf(fetchMock)).toEqual({ name: "A" });
  });

  it("blocks an empty name", async () => {
    const user = userEvent.setup();
    const fetchMock = mockCreate([TOKEN_A]);
    render(<CreateLinkForm siteUrl={SITE} onCreated={vi.fn()} onUnauthorized={vi.fn()} />);
    await user.type(screen.getByLabelText(/Tên link/), "   ");
    await user.click(screen.getByRole("button", { name: "Tạo link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Hãy nhập tên link");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a date in the past", async () => {
    const user = userEvent.setup();
    const fetchMock = mockCreate([TOKEN_A]);
    render(<CreateLinkForm siteUrl={SITE} onCreated={vi.fn()} onUnauthorized={vi.fn()} />);
    await user.type(screen.getByLabelText(/Tên link/), "A");
    await user.type(screen.getByLabelText(/Hết hạn/), "2001-01-01");
    await user.click(screen.getByRole("button", { name: "Tạo link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("đã qua");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a Twistfit cap that is not an integer >= 1", async () => {
    const user = userEvent.setup();
    const fetchMock = mockCreate([TOKEN_A]);
    render(<CreateLinkForm siteUrl={SITE} onCreated={vi.fn()} onUnauthorized={vi.fn()} />);
    await user.type(screen.getByLabelText(/Tên link/), "A");
    await user.type(screen.getByLabelText(/Twistfit/), "0");
    await user.click(screen.getByRole("button", { name: "Tạo link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("số nguyên");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the full link once, then replaces it with the next one", async () => {
    const user = userEvent.setup();
    mockCreate([TOKEN_A, TOKEN_B]);
    render(<CreateLinkForm siteUrl={`${SITE}/`} onCreated={vi.fn()} onUnauthorized={vi.fn()} />);
    await user.type(screen.getByLabelText(/Tên link/), "A");
    await user.click(screen.getByRole("button", { name: "Tạo link" }));
    expect(await screen.findByText(`${SITE}/i/${TOKEN_A}`)).toBeInTheDocument();
    expect(screen.getByText(/Link chỉ hiện đầy đủ một lần/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tên link/)).toHaveValue("");

    await user.type(screen.getByLabelText(/Tên link/), "B");
    await user.click(screen.getByRole("button", { name: "Tạo link" }));
    expect(await screen.findByText(`${SITE}/i/${TOKEN_B}`)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(TOKEN_A))).toBeNull();
  });

  it("does not keep the link after a remount (reload) nor in web storage", async () => {
    const user = userEvent.setup();
    mockCreate([TOKEN_A]);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { unmount } = render(<CreateLinkForm siteUrl={SITE} onCreated={vi.fn()} onUnauthorized={vi.fn()} />);
    await user.type(screen.getByLabelText(/Tên link/), "A");
    await user.click(screen.getByRole("button", { name: "Tạo link" }));
    await screen.findByText(`${SITE}/i/${TOKEN_A}`);
    unmount();
    render(<CreateLinkForm siteUrl={SITE} onCreated={vi.fn()} onUnauthorized={vi.fn()} />);
    expect(screen.queryByText(new RegExp(TOKEN_A))).toBeNull();
    for (const call of setItem.mock.calls) expect(call.join(" ")).not.toContain(TOKEN_A);
  });

  it("copies the link with the clipboard API", async () => {
    const user = userEvent.setup();
    mockCreate([TOKEN_A]);
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CreateLinkForm siteUrl={SITE} onCreated={vi.fn()} onUnauthorized={vi.fn()} />);
    await user.type(screen.getByLabelText(/Tên link/), "A");
    await user.click(screen.getByRole("button", { name: "Tạo link" }));
    await user.click(await screen.findByRole("button", { name: "Sao chép" }));
    expect(writeText).toHaveBeenCalledWith(`${SITE}/i/${TOKEN_A}`);
    expect(await screen.findByText("Đã sao chép")).toBeInTheDocument();
  });

  it("falls back to selecting the text when the clipboard fails", async () => {
    const user = userEvent.setup();
    mockCreate([TOKEN_A]);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) },
      configurable: true,
    });
    render(<CreateLinkForm siteUrl={SITE} onCreated={vi.fn()} onUnauthorized={vi.fn()} />);
    await user.type(screen.getByLabelText(/Tên link/), "A");
    await user.click(screen.getByRole("button", { name: "Tạo link" }));
    await user.click(await screen.findByRole("button", { name: "Sao chép" }));
    expect(await screen.findByText(/đã được bôi đen/)).toBeInTheDocument();
    expect(window.getSelection()?.toString()).toBe(`${SITE}/i/${TOKEN_A}`);
  });

  it("warns and falls back to the current origin without SITE_URL", async () => {
    const user = userEvent.setup();
    mockCreate([TOKEN_A]);
    render(<CreateLinkForm siteUrl="" onCreated={vi.fn()} onUnauthorized={vi.fn()} />);
    expect(screen.getByText(/SITE_URL chưa được đặt, hãy thay tên miền thủ công/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Tên link/), "A");
    await user.click(screen.getByRole("button", { name: "Tạo link" }));
    expect(await screen.findByText(`${window.location.origin}/i/${TOKEN_A}`)).toBeInTheDocument();
  });

  it("calls onUnauthorized on 401", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "admin_required" }, { status: 401 })));
    const onUnauthorized = vi.fn();
    render(<CreateLinkForm siteUrl={SITE} onCreated={vi.fn()} onUnauthorized={onUnauthorized} />);
    await user.type(screen.getByLabelText(/Tên link/), "A");
    await user.click(screen.getByRole("button", { name: "Tạo link" }));
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
  });

  it("shows an error when the API rejects the data", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "invalid_request" }, { status: 422 })));
    render(<CreateLinkForm siteUrl={SITE} onCreated={vi.fn()} onUnauthorized={vi.fn()} />);
    await user.type(screen.getByLabelText(/Tên link/), "A");
    await user.click(screen.getByRole("button", { name: "Tạo link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("không hợp lệ");
  });
});
