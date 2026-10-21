import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@/content/types";
import viMessages from "../../messages/vi.json";
import enMessages from "../../messages/en.json";
import { InviteNotice } from "./InviteNotice";

let search = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

const TEXT: Record<Locale, string> = {
  vi: "Link mời không còn hiệu lực. Bạn vẫn xem được các bản phát lại.",
  en: "This invite link is no longer valid. You can still view the replays.",
};
const CLOSE: Record<Locale, string> = { vi: "Đóng thông báo", en: "Dismiss notice" };

function renderNotice(locale: Locale = "vi") {
  const messages = locale === "vi" ? viMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <InviteNotice />
    </NextIntlClientProvider>,
  );
}

let replaceState: ReturnType<typeof vi.spyOn>;
const realReplaceState = window.history.replaceState.bind(window.history);

beforeEach(() => {
  search = "";
  replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  realReplaceState({}, "", "/");
});

describe("InviteNotice", () => {
  for (const locale of ["vi", "en"] as const) {
    it(`shows the short notice for ?invite=invalid (${locale}), announced as a status`, () => {
      search = "invite=invalid";
      renderNotice(locale);
      const notice = screen.getByRole("status");
      expect(notice).toHaveTextContent(TEXT[locale]);
      expect(screen.getByRole("button", { name: CLOSE[locale] })).toBeInTheDocument();
    });
  }

  it("is absent without the query, and with any other value", () => {
    renderNotice();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    for (const value of ["", "valid", "INVALID", "expired", "abc123"]) {
      search = `invite=${value}`;
      const { unmount } = renderNotice();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("gives no reason and never echoes a query value", () => {
    search = "invite=invalid&ref=SECRET-CODE-123";
    renderNotice();
    const text = screen.getByRole("status").textContent ?? "";
    expect(text).toBe(TEXT.vi);
    expect(text).not.toMatch(/SECRET|123|hết hạn|thu hồi|bị khoá|sai|expired|revoked/i);
  });

  it("closes with the button and stays closed", async () => {
    search = "invite=invalid";
    const user = userEvent.setup();
    const { rerender } = renderNotice();
    await user.click(screen.getByRole("button", { name: CLOSE.vi }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    // The URL no longer has the param, but a re-render with it (same page view) stays hidden.
    rerender(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <InviteNotice />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("closes with the Escape key", async () => {
    search = "invite=invalid";
    const user = userEvent.setup();
    renderNotice();
    expect(screen.getByRole("status")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("ignores other keys", async () => {
    search = "invite=invalid";
    const user = userEvent.setup();
    renderNotice();
    await user.keyboard("a{Enter}");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("removes only `invite` from the URL, without a reload, keeping the rest", () => {
    realReplaceState({}, "", "/vi/projects?invite=invalid&group=ai#top");
    replaceState.mockClear();
    search = "invite=invalid&group=ai";
    renderNotice();
    expect(replaceState).toHaveBeenCalledTimes(1);
    const url = String(replaceState.mock.calls[0][2]);
    expect(url).toBe("/vi/projects?group=ai#top");
  });

  it("removes the query entirely when `invite` is the only param", () => {
    realReplaceState({}, "", "/en?invite=invalid");
    replaceState.mockClear();
    search = "invite=invalid";
    renderNotice("en");
    expect(String(replaceState.mock.calls[0][2])).toBe("/en");
  });

  it("does not touch the URL when there is no notice", () => {
    renderNotice();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("keeps showing after the param disappears from the URL (our own replaceState)", () => {
    search = "invite=invalid";
    const { rerender } = renderNotice();
    search = "";
    act(() => {
      rerender(
        <NextIntlClientProvider locale="vi" messages={viMessages}>
          <InviteNotice />
        </NextIntlClientProvider>,
      );
    });
    expect(screen.getByRole("status")).toHaveTextContent(TEXT.vi);
  });
});
