import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@/content/types";
import { InviteSessionProvider } from "@/lib/invite/use-invite-session";
import viMessages from "../../../messages/vi.json";
import enMessages from "../../../messages/en.json";
import { KnowledgeBaseSwitch } from "./KnowledgeBaseSwitch";

const ON = { chat: true, twistfit: false, gia_pha: false };
const OFF = { chat: false, twistfit: false, gia_pha: false };

type Session = { invited: boolean; features: typeof ON } | "pending";

function stubFetch(session: Session, stream?: () => Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/session") {
      if (session === "pending") return new Promise<Response>(() => {});
      return Response.json(session);
    }
    if (url === "/api/chat/status") return Response.json({ enabled: true });
    if (url === "/api/chat/stream" && stream) return stream();
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function chatCalls(fetchMock: ReturnType<typeof stubFetch>) {
  return fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/chat/"));
}

function renderSwitch(locale: Locale = "vi") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "vi" ? viMessages : enMessages}>
      <InviteSessionProvider>
        <KnowledgeBaseSwitch locale={locale} />
      </InviteSessionProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("KnowledgeBaseSwitch", () => {
  for (const locale of ["vi", "en"] as const) {
    const m = locale === "vi" ? viMessages : enMessages;

    it(`without an invite, shows the replay and its notice and never calls /api/chat (${locale})`, async () => {
      const fetchMock = stubFetch({ invited: false, features: OFF });
      const { container } = renderSwitch(locale);
      expect(await screen.findByText(m.kb.replayNotice)).toBeInTheDocument();
      expect(screen.getByText(m.demo.badge.replay.label)).toBeInTheDocument();
      expect(screen.queryByText(m.demo.badge.live.label, { exact: true })).toBeNull();
      expect(container.querySelector('[data-role="user"]')).not.toBeNull();
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(chatCalls(fetchMock)).toEqual([]);
    });
  }

  it("an invited visitor without the chat feature still gets the replay", async () => {
    const fetchMock = stubFetch({ invited: true, features: OFF });
    renderSwitch();
    expect(await screen.findByText(viMessages.kb.replayNotice)).toBeInTheDocument();
    expect(chatCalls(fetchMock)).toEqual([]);
  });

  it("with an invite that includes chat, shows the live demo", async () => {
    const fetchMock = stubFetch({ invited: true, features: ON });
    renderSwitch();
    expect(await screen.findByRole("textbox", { name: "Câu hỏi của bạn" })).toBeInTheDocument();
    expect(screen.queryByText(viMessages.kb.replayNotice)).toBeNull();
    await waitFor(() => expect(chatCalls(fetchMock).map(([url]) => url)).toEqual(["/api/chat/status"]));
  });

  it("while the session is unknown, shows a neutral waiting block and neither demo", () => {
    const fetchMock = stubFetch("pending");
    const { container } = renderSwitch();
    expect(container.querySelector('[data-kb-mode="pending"]')).not.toBeNull();
    expect(screen.getByText(viMessages.kb.modeLoading)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText(viMessages.kb.replayNotice)).toBeNull();
    expect(screen.queryByText(viMessages.demo.badge.replay.label)).toBeNull();
    expect(chatCalls(fetchMock)).toEqual([]);
  });

  it("falls back to the replay, without a reload, when the invite stops working mid-visit", async () => {
    const fetchMock = stubFetch({ invited: true, features: ON }, () =>
      Response.json({ code: "invite_required" }, { status: 401 }),
    );
    const user = userEvent.setup();
    renderSwitch();
    const input = await screen.findByRole("textbox", { name: "Câu hỏi của bạn" });
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, "Báo giá mới nhất?{Enter}");
    const lost = await screen.findByText(viMessages.kb.errors.inviteRequired);
    expect(screen.getByText(viMessages.kb.replayNotice)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    await waitFor(() => expect(lost.closest("[tabindex='-1']")).toHaveFocus());
    expect(chatCalls(fetchMock).filter(([url]) => url === "/api/chat/stream")).toHaveLength(1);
  });
});
