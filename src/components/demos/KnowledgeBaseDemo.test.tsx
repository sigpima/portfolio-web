import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatHttpError, fetchChatStatus, streamChat } from "@/lib/chat/client";
import type { ChatEvent } from "@/lib/chat/types";
import type { Locale } from "@/content/types";
import viMessages from "../../../messages/vi.json";
import enMessages from "../../../messages/en.json";
import { KnowledgeBaseDemo } from "./KnowledgeBaseDemo";
import { demoComponents } from "./registry";

vi.mock("@/lib/chat/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chat/client")>();
  return { ...actual, streamChat: vi.fn(), fetchChatStatus: vi.fn() };
});

const mockStream = vi.mocked(streamChat);
const mockStatus = vi.mocked(fetchChatStatus);

const ANSWER = "Báo giá mới nhất là 1,24 tỷ đồng.";

function happyEvents(sessionId = "s-1", answer = ANSWER): ChatEvent[] {
  return [
    { type: "start", session_id: sessionId },
    { type: "tool_call", call_id: 1, tool: "find_quotations", args: { limit: 1 } },
    {
      type: "tool_result",
      call_id: 1,
      tool: "find_quotations",
      ok: true,
      duration_ms: 42,
      row_count: 1,
      sql: "SELECT 1",
      preview: "total 1240000000",
    },
    { type: "answer", text: answer },
    { type: "done", duration_ms: 900 },
  ];
}

function streamOf(events: ChatEvent[], thenThrow?: unknown) {
  return async function* () {
    for (const e of events) yield e;
    if (thenThrow) throw thenThrow;
  };
}

/** A stream the test drives one event at a time. */
function controlledStream() {
  const queue: (ChatEvent | { end: true })[] = [];
  let wake: (() => void) | null = null;
  async function* gen(): AsyncGenerator<ChatEvent> {
    for (;;) {
      while (queue.length === 0) await new Promise<void>((r) => (wake = r));
      const next = queue.shift()!;
      if ("end" in next) return;
      yield next;
    }
  }
  const push = async (x: ChatEvent | { end: true }) => {
    await act(async () => {
      queue.push(x);
      wake?.();
      wake = null;
      await vi.advanceTimersByTimeAsync(1);
    });
  };
  return { gen, emit: (e: ChatEvent) => push(e), end: () => push({ end: true }) };
}

function mockMatchMedia(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function node(id: string) {
  const el = document.querySelector(`li[data-node-id="${id}"]`);
  if (!el) throw new Error(`node ${id} missing`);
  return el as HTMLElement;
}

function chat() {
  return within(screen.getByRole("region", { name: "Chat với bot" }));
}

function botBubbles() {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-role="bot"]'));
}

async function renderDemo(locale: Locale = "vi") {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const messages = locale === "vi" ? viMessages : enMessages;
  const utils = render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <KnowledgeBaseDemo locale={locale} />
    </NextIntlClientProvider>,
  );
  return { user, ...utils };
}

async function readyInput(name = "Câu hỏi của bạn") {
  const input = await screen.findByRole("textbox", { name });
  await waitFor(() => expect(input).toBeEnabled());
  return input;
}

async function finishTyping() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20_000);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockMatchMedia(false);
  mockStatus.mockResolvedValue({ enabled: true });
  mockStream.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("KnowledgeBaseDemo", () => {
  it("is registered under the knowledge-base key", () => {
    expect(demoComponents["knowledge-base"]).toBe(KnowledgeBaseDemo);
  });

  it("shows the paused panel and no input when the demo is disabled", async () => {
    mockStatus.mockResolvedValue({ enabled: false });
    await renderDemo();
    expect(await screen.findByText("Demo tạm nghỉ")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gửi" })).not.toBeInTheDocument();
  });

  it("renders the diagram above the chat, plus the synthetic-data and privacy notes", async () => {
    await renderDemo();
    const input = await readyInput();
    const diagram = screen.getByRole("region", { name: "Luồng suy luận của bot" });
    expect(diagram.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/dữ liệu giả lập/i)).toBeInTheDocument();
    expect(screen.getByText(/không được lưu/i)).toBeInTheDocument();
  });

  it("progresses the diagram nodes in order and types out the answer", async () => {
    const s = controlledStream();
    mockStream.mockImplementation(s.gen);
    const { user } = await renderDemo();
    const input = await readyInput();
    await user.type(input, "Báo giá mới nhất có giá bao nhiêu?");
    await user.click(screen.getByRole("button", { name: "Gửi" }));

    expect(mockStream).toHaveBeenCalledWith(
      { message: "Báo giá mới nhất có giá bao nhiêu?", sessionId: null },
      expect.any(AbortSignal),
    );
    expect(node("question")).toHaveAttribute("data-status", "done");
    expect(node("model-1")).toHaveAttribute("data-status", "active");
    expect(node("tool-1")).toHaveAttribute("data-status", "idle");

    const [start, call, result, answer, done] = happyEvents();
    await s.emit(start);
    await s.emit(call);
    expect(node("model-1")).toHaveAttribute("data-status", "done");
    expect(node("tool-1")).toHaveAttribute("data-status", "active");
    expect(node("db-1")).toHaveAttribute("data-status", "idle");

    await s.emit(result);
    expect(node("tool-1")).toHaveAttribute("data-status", "done");
    expect(node("db-1")).toHaveAttribute("data-status", "done");
    expect(node("db-1")).toHaveTextContent("1 dòng");
    expect(node("answer")).toHaveAttribute("data-status", "active");

    await s.emit(answer);
    expect(node("answer")).toHaveAttribute("data-status", "done");
    // Typing out: not complete right away.
    expect(botBubbles().at(-1)?.textContent).not.toBe(ANSWER);

    await s.emit(done);
    await s.end();
    await finishTyping();
    expect(botBubbles().at(-1)).toHaveTextContent(ANSWER);
    expect(botBubbles().at(-1)?.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
  });

  it("shows the answer at once when reduced motion is preferred", async () => {
    mockMatchMedia(true);
    mockStream.mockImplementation(streamOf(happyEvents()));
    const { user } = await renderDemo();
    const input = await readyInput();
    await user.type(input, "hi");
    await user.click(screen.getByRole("button", { name: "Gửi" }));
    await waitFor(() => expect(botBubbles().at(-1)).toHaveTextContent(ANSWER));
  });

  it("does not call streamChat for an empty or whitespace-only question", async () => {
    const { user } = await renderDemo();
    const input = await readyInput();
    await user.click(screen.getByRole("button", { name: "Gửi" }));
    await user.type(input, "    {Enter}");
    expect(mockStream).not.toHaveBeenCalled();
  });

  it("shows an inline error and does not call streamChat for more than 500 characters", async () => {
    const { user } = await renderDemo();
    const input = await readyInput();
    await user.click(input);
    await user.paste("a".repeat(501));
    await user.click(screen.getByRole("button", { name: "Gửi" }));
    expect(mockStream).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/500 ký tự/)).toBeInTheDocument();
  });

  it("disables send while a question is running and ignores a double submit", async () => {
    const s = controlledStream();
    mockStream.mockImplementation(s.gen);
    const { user } = await renderDemo();
    const input = await readyInput();
    await user.type(input, "Câu một{Enter}");
    expect(screen.getByRole("button", { name: "Gửi" })).toBeDisabled();
    await user.type(input, "Câu hai{Enter}");
    expect(mockStream).toHaveBeenCalledTimes(1);
    for (const e of happyEvents()) await s.emit(e);
    await s.end();
    await user.type(input, "x");
    expect(screen.getByRole("button", { name: "Gửi" })).toBeEnabled();
  });

  it("shows a localized message for an error event and makes the input usable again", async () => {
    mockStream.mockImplementation(
      streamOf([
        { type: "start", session_id: "s-1" },
        { type: "error", code: "model", message: "RAW UPSTREAM 500 Gemini quota" },
      ]),
    );
    const { user } = await renderDemo();
    const input = await readyInput();
    await user.type(input, "Câu hỏi{Enter}");
    expect(await chat().findByText(viMessages.kb.errors.model)).toBeInTheDocument();
    expect(screen.queryByText(/RAW UPSTREAM/)).not.toBeInTheDocument();
    expect(node("model-1")).toHaveAttribute("data-status", "error");
    await user.type(input, "tiếp");
    expect(input).toBeEnabled();
    expect(screen.getByRole("button", { name: "Gửi" })).toBeEnabled();
  });

  it("switches to the paused panel on ChatHttpError demo_disabled", async () => {
    mockStream.mockImplementation(streamOf([], new ChatHttpError("demo_disabled", 503)));
    const { user } = await renderDemo();
    const input = await readyInput();
    await user.type(input, "Câu hỏi{Enter}");
    expect(await screen.findByText("Demo tạm nghỉ")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows an inline input error on ChatHttpError too_long", async () => {
    mockStream.mockImplementation(streamOf([], new ChatHttpError("too_long", 413)));
    const { user } = await renderDemo();
    const input = await readyInput();
    await user.type(input, "Câu hỏi{Enter}");
    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByText(/500 ký tự/)).toBeInTheDocument();
  });

  it("offers a new conversation on session_full that clears chat, flow and session id", async () => {
    mockStream
      .mockImplementationOnce(streamOf(happyEvents("s-full")))
      .mockImplementationOnce(
        streamOf([{ type: "error", code: "session_full", message: "session is full" }]),
      )
      .mockImplementationOnce(streamOf(happyEvents("s-2")));
    mockMatchMedia(true);
    const { user } = await renderDemo();
    const input = await readyInput();
    await user.type(input, "Một{Enter}");
    await waitFor(() => expect(botBubbles().at(-1)).toHaveTextContent(ANSWER));
    await user.type(input, "Hai{Enter}");
    expect(mockStream).toHaveBeenLastCalledWith(
      { message: "Hai", sessionId: "s-full" },
      expect.any(AbortSignal),
    );
    const button = await screen.findByRole("button", { name: "Cuộc trò chuyện mới" });
    expect(chat().getByText(viMessages.kb.errors.sessionFull)).toBeInTheDocument();

    await user.click(button);
    expect(screen.queryByText("Một")).not.toBeInTheDocument();
    expect(screen.queryByText(viMessages.kb.errors.sessionFull)).not.toBeInTheDocument();
    expect(botBubbles()).toHaveLength(0);
    expect(node("question")).toHaveAttribute("data-status", "idle");
    expect(node("model-1")).toHaveAttribute("data-status", "idle");

    await user.type(screen.getByRole("textbox", { name: "Câu hỏi của bạn" }), "Ba{Enter}");
    expect(mockStream).toHaveBeenLastCalledWith({ message: "Ba", sessionId: null }, expect.any(AbortSignal));
  });

  it("sends exactly the chip text when a chip is clicked", async () => {
    mockStream.mockImplementation(streamOf(happyEvents()));
    const { user } = await renderDemo();
    await readyInput();
    const chip = screen.getByRole("button", { name: viMessages.kb.chips.c2 });
    await user.click(chip);
    expect(mockStream).toHaveBeenCalledWith(
      { message: viMessages.kb.chips.c2, sessionId: null },
      expect.any(AbortSignal),
    );
  });

  it("reuses the session id from start for the next question", async () => {
    mockMatchMedia(true);
    mockStream.mockImplementation(streamOf(happyEvents("abc-123")));
    const { user } = await renderDemo();
    const input = await readyInput();
    await user.type(input, "Một{Enter}");
    await waitFor(() => expect(botBubbles()).toHaveLength(1));
    await user.type(input, "Hai{Enter}");
    expect(mockStream).toHaveBeenLastCalledWith(
      { message: "Hai", sessionId: "abc-123" },
      expect.any(AbortSignal),
    );
  });

  it("shows a generic error on a network TypeError without crashing", async () => {
    mockStream.mockImplementation(streamOf([], new TypeError("Failed to fetch")));
    const { user } = await renderDemo();
    const input = await readyInput();
    await user.type(input, "Câu hỏi{Enter}");
    expect(await chat().findByText(viMessages.kb.errors.generic)).toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
    expect(input).toBeEnabled();
  });

  it("aborts the in-flight request on unmount", async () => {
    let signal: AbortSignal | undefined;
    const s = controlledStream();
    mockStream.mockImplementation((_req, sig) => {
      signal = sig;
      return s.gen();
    });
    const { user, unmount } = await renderDemo();
    const input = await readyInput();
    await user.type(input, "Câu hỏi{Enter}");
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("renders English strings for the en locale", async () => {
    await renderDemo("en");
    await readyInput("Your question");
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: enMessages.kb.chips.c1 })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: enMessages.kb.flowLabel })).getAllByRole("listitem")).toHaveLength(5);
  });
});
