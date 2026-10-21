import { readFileSync } from "node:fs";
import path from "node:path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import LinksTable, { STATUS_STYLES } from "./LinksTable";
import type { AdminLink } from "./types";

const XSS = "<img src=x onerror=alert(1)>";

function link(id: number, status: AdminLink["status"], extra: Partial<AdminLink> = {}): AdminLink {
  return {
    id,
    name: `Link ${id}`,
    status,
    created_at: "2026-10-21T02:12:00Z",
    expires_at: null,
    last_used_at: null,
    twistfit_max: null,
    counts: { chat: 0, twistfit: 0, gia_pha: 0 },
    ...extra,
  };
}

const LINKS: AdminLink[] = [
  link(1, "active", {
    name: "Công ty X – vòng 1",
    last_used_at: "2026-10-21T09:41:00Z",
    counts: { chat: 14, twistfit: 3, gia_pha: 2 },
    twistfit_max: 10,
  }),
  link(2, "unused", { name: XSS }),
  link(3, "revoked"),
  link(4, "expired"),
];

afterEach(() => {
  vi.useRealTimers();
});

function renderTable(props: Partial<React.ComponentProps<typeof LinksTable>> = {}) {
  const onSelect = vi.fn();
  const onRevoke = vi.fn(async () => {});
  render(<LinksTable links={LINKS} selectedId={null} onSelect={onSelect} onRevoke={onRevoke} {...props} />);
  return { onSelect, onRevoke };
}

function row(name: string) {
  return screen.getByRole("button", { name }).closest("tr")!;
}

describe("LinksTable", () => {
  it("has all column headers with scope", () => {
    renderTable();
    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual([
      "Tên",
      "Trạng thái",
      "Tạo lúc",
      "Dùng gần nhất",
      "Bot",
      "Twistfit",
      "Gia phả",
      "Thao tác",
    ]);
    for (const h of headers) expect(h).toHaveAttribute("scope", "col");
  });

  it("shows Vietnamese status labels, times in Vietnam time and counts", () => {
    renderTable();
    const first = row("Công ty X – vòng 1");
    expect(within(first).getByText("Đang hoạt động")).toBeInTheDocument();
    expect(within(first).getByText("21/10 09:12")).toBeInTheDocument();
    expect(within(first).getByText("21/10 16:41")).toBeInTheDocument();
    expect(within(first).getByText("14")).toBeInTheDocument();
    expect(within(first).getByText("3/10")).toBeInTheDocument();
    expect(within(first).getByText("2")).toBeInTheDocument();
    expect(within(row(XSS)).getByText("Chưa ai mở")).toBeInTheDocument();
    expect(within(row("Link 3")).getByText("Đã thu hồi")).toBeInTheDocument();
    expect(within(row("Link 4")).getByText("Hết hạn")).toBeInTheDocument();
  });

  it("renders names as text, never as HTML", () => {
    const { container } = render(
      <LinksTable links={LINKS} selectedId={null} onSelect={vi.fn()} onRevoke={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: XSS })).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("has a shape cue next to each status label", () => {
    renderTable();
    for (const status of ["active", "unused", "revoked", "expired"] as const) {
      const label = screen.getByText(STATUS_STYLES[status].label);
      expect(label.closest("[data-status]")?.querySelector("[data-shape]")).not.toBeNull();
    }
  });

  it("offers no revoke button on revoked or expired links", () => {
    renderTable();
    expect(within(row("Công ty X – vòng 1")).getByRole("button", { name: /Thu hồi/ })).toBeInTheDocument();
    expect(within(row(XSS)).getByRole("button", { name: /Thu hồi/ })).toBeInTheDocument();
    expect(within(row("Link 3")).queryByRole("button", { name: /Thu hồi/ })).toBeNull();
    expect(within(row("Link 4")).queryByRole("button", { name: /Thu hồi/ })).toBeNull();
  });

  it("needs a second click to revoke", async () => {
    const user = userEvent.setup();
    const { onRevoke, onSelect } = renderTable();
    const r = row("Công ty X – vòng 1");
    await user.click(within(r).getByRole("button", { name: /Thu hồi/ }));
    expect(onRevoke).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(within(r).getByRole("button", { name: /Xác nhận thu hồi/ }));
    expect(onRevoke).toHaveBeenCalledWith(1);
  });

  it("drops the confirmation after 5 seconds", () => {
    vi.useFakeTimers();
    const { onRevoke } = renderTable();
    const r = row("Công ty X – vòng 1");
    fireEvent.click(within(r).getByRole("button", { name: /Thu hồi/ }));
    expect(within(r).getByRole("button", { name: /Xác nhận thu hồi/ })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(within(r).queryByRole("button", { name: /Xác nhận thu hồi/ })).toBeNull();
    fireEvent.click(within(r).getByRole("button", { name: /Thu hồi/ }));
    expect(onRevoke).not.toHaveBeenCalled();
  });

  it("selects a row by click and by keyboard", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderTable();
    await user.click(within(row("Link 3")).getByText("Đã thu hồi"));
    expect(onSelect).toHaveBeenLastCalledWith(3);
    screen.getByRole("button", { name: "Link 4" }).focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith(4);
    await user.keyboard(" ");
    expect(onSelect).toHaveBeenCalledTimes(3);
  });

  it("marks the selected row", () => {
    renderTable({ selectedId: 1 });
    expect(screen.getByRole("button", { name: "Công ty X – vòng 1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Link 3" })).toHaveAttribute("aria-pressed", "false");
  });
});

// --- contrast of the status labels with the project tokens ---

function tokens(): Record<string, string> {
  const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1]] = m[2];
  return out;
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function blend(fg: string, alpha: number, bg: string): string {
  const f = rgb(fg);
  const b = rgb(bg);
  const c = f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("status label contrast", () => {
  const t = tokens();
  const card = t["surface-container-low"];
  // The selected row tints the card with primary-container at 10 %.
  const selected = blend(t["primary-container"], 0.1, card);

  it.each(Object.entries(STATUS_STYLES))("%s label is at least 4.5:1", (_status, style) => {
    const fg = t[style.token];
    expect(fg).toBeDefined();
    expect(style.className).toContain(`text-${style.token}`);
    for (const bg of [card, selected]) {
      const pillBg = blend(fg, style.bgAlpha, bg);
      expect(contrast(fg, pillBg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
