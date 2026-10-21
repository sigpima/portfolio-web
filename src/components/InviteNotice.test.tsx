import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@/content/types";
import viMessages from "../../messages/vi.json";
import enMessages from "../../messages/en.json";
import { InviteSessionProvider } from "@/lib/invite/use-invite-session";
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
const UNAVAILABLE: Record<Locale, string> = {
  vi: "Không mở được link lúc này. Hãy thử lại sau ít phút.",
  en: "We couldn't open the link right now. Please try again in a few minutes.",
};
const OK: Record<Locale, string> = {
  vi: "Link mời đã được kích hoạt. Bạn có thể dùng bot trực tiếp.",
  en: "Your invite is active. You can use the live bot.",
};
const OK_NO_SESSION: Record<Locale, string> = {
  vi: "Link mời hợp lệ nhưng trình duyệt chưa lưu được phiên. Hãy bật cookie hoặc mở link trong trình duyệt chính (Chrome/Safari).",
  en: "The invite is valid but your browser did not keep the session. Enable cookies or open the link in your main browser (Chrome/Safari).",
};

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
    for (const value of ["", "valid", "INVALID", "OK", "Unavailable", "expired", "abc123"]) {
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

describe("InviteNotice: ?invite=unavailable", () => {
  for (const locale of ["vi", "en"] as const) {
    it(`says the link could not be opened right now (${locale}), nothing about the token`, () => {
      search = "invite=unavailable&ref=SECRET-CODE-123";
      renderNotice(locale);
      const text = screen.getByRole("status").textContent ?? "";
      expect(text).toBe(UNAVAILABLE[locale]);
      expect(text).not.toMatch(/SECRET|123|hết hạn|thu hồi|expired|revoked|invalid|không còn hiệu lực/i);
    });
  }

  it("removes the param and closes with Escape", async () => {
    realReplaceState({}, "", "/vi?invite=unavailable");
    replaceState.mockClear();
    search = "invite=unavailable";
    const user = userEvent.setup();
    renderNotice();
    expect(String(replaceState.mock.calls[0][2])).toBe("/vi");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("InviteNotice: ?invite=ok", () => {
  let resolveSession: (invited: boolean) => void = () => {};

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (input: RequestInfo | URL) =>
          new Promise<Response>((resolve, reject) => {
            if (String(input) !== "/api/session") reject(new Error(`unexpected fetch ${String(input)}`));
            resolveSession = (invited) =>
              resolve(Response.json({ invited, features: { chat: invited, twistfit: false, gia_pha: false } }));
          }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderWithSession(locale: Locale = "vi") {
    const messages = locale === "vi" ? viMessages : enMessages;
    return render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <InviteSessionProvider>
          <button type="button">elsewhere</button>
          <InviteNotice />
        </InviteSessionProvider>
      </NextIntlClientProvider>,
    );
  }

  it("shows nothing until the invite session is known, but cleans the URL at once", () => {
    realReplaceState({}, "", "/vi?invite=ok");
    replaceState.mockClear();
    search = "invite=ok";
    renderWithSession();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(String(replaceState.mock.calls[0][2])).toBe("/vi");
  });

  for (const locale of ["vi", "en"] as const) {
    it(`confirms the invite once the session says invited (${locale})`, async () => {
      search = "invite=ok";
      renderWithSession(locale);
      await act(async () => resolveSession(true));
      expect(await screen.findByRole("status")).toHaveTextContent(OK[locale]);
      expect(screen.getByRole("button", { name: CLOSE[locale] })).toBeInTheDocument();
    });

    it(`warns when the session did not stick (cookies blocked, in-app browser) (${locale})`, async () => {
      search = "invite=ok";
      renderWithSession(locale);
      await act(async () => resolveSession(false));
      expect(await screen.findByRole("status")).toHaveTextContent(OK_NO_SESSION[locale]);
    });
  }

  it("does not steal focus", async () => {
    search = "invite=ok";
    renderWithSession();
    const other = screen.getByRole("button", { name: "elsewhere" });
    other.focus();
    await act(async () => resolveSession(true));
    await screen.findByRole("status");
    expect(document.activeElement).toBe(other);
  });

  it("closes with the button and with Escape", async () => {
    search = "invite=ok";
    const user = userEvent.setup();
    const { unmount } = renderWithSession();
    await act(async () => resolveSession(true));
    await user.click(await screen.findByRole("button", { name: CLOSE.vi }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    unmount();

    renderWithSession();
    await act(async () => resolveSession(false));
    await screen.findByRole("status");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps showing after the param disappears from the URL", async () => {
    search = "invite=ok";
    const { rerender } = renderWithSession();
    search = "";
    rerender(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <InviteSessionProvider>
          <button type="button">elsewhere</button>
          <InviteNotice />
        </InviteSessionProvider>
      </NextIntlClientProvider>,
    );
    await act(async () => resolveSession(true));
    expect(await screen.findByRole("status")).toHaveTextContent(OK.vi);
  });
});
