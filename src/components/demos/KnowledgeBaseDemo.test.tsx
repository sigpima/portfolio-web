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
import { KnowledgeBaseSwitch } from "./KnowledgeBaseSwitch";
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

/** The rendered (Markdown) answer inside the latest bot bubble. */
function answerText() {
  return botBubbles().at(-1)?.querySelector<HTMLElement>('[data-role="markdown"]') ?? null;
}

function live() {
  const el = document.querySelector<HTMLElement>('[data-role="live"]');
  if (!el) throw new Error("live region missing");
  return el;
}

const ERROR = { selector: '[data-role="error"]' };

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
  it("is reached through the invite-aware switch registered under the knowledge-base key", () => {
    expect(demoComponents["knowledge-base"]).toBe(KnowledgeBaseSwitch);
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

  it("the privacy note says questions are not stored, that the link's feature use is logged, and that questions go to Google Gemini (vi and en)", async () => {
    const expected = {
      vi: [
        "Câu hỏi của bạn không được lưu.",
        "ghi lại rằng link mời của bạn đã dùng tính năng nào và lúc nào",
        "Câu hỏi được gửi tới Google Gemini để tạo câu trả lời.",
      ],
      en: [
        "Your questions are not stored.",
        "records which feature your invite link used, and when",
        "Each question is sent to Google Gemini to produce the answer.",
      ],
    } as const;
    for (const locale of ["vi", "en"] as const) {
      const { unmount } = await renderDemo(locale);
      const note = await screen.findByText(expected[locale][0], { exact: false });
      expect(note.textContent).toContain(expected[locale][1]);
      expect(note.textContent).toContain(expected[locale][2]);
      unmount();
    }
  });

  it("progresses the diagram nodes in order and shows the whole answer at once", async () => {
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
        expect(node("answer")).toHaveAttribute("data-status", "active");

    await s.emit(answer);
    expect(node("answer")).toHaveAttribute("data-status", "done");
    // The answer is shown in full at once, and the live region holds it too (never a prefix).
    expect(answerText()).toHaveTextContent(ANSWER);
    expect(live()).toHaveAttribute("aria-live", "polite");
    expect(live().textContent).toBe(ANSWER);

    await s.emit(done);
    await s.end();
    expect(answerText()).toHaveTextContent(ANSWER);
    expect(botBubbles().at(-1)?.closest("[aria-live]")).toBeNull();
    // The echoed question is not announced.
    expect(document.querySelector('[data-role="user"]')?.closest("[aria-live]")).toBeNull();
    expect(live().textContent).toBe(ANSWER);
  });

  it("renders the answer as Markdown (bold, list, table, safe link) and never as raw HTML", async () => {
    const markdown = [
      "**Báo giá mới nhất** là `BG-031`:",
      "",
      "- Tổng: 1,24 tỷ",
      "- Nhân công: 38%",
      "",
      "| Hạng mục | Tiền |",
      "| --- | --- |",
      "| Chống thấm | 120 |",
      "",
      "Xem [chi tiết](https://example.com/bg) <script>alert(1)</script> ![x](https://evil.test/p.png)",
    ].join("\n");
    mockStream.mockImplementation(streamOf(happyEvents("s-1", markdown)));
    const { user } = await renderDemo();
    const input = await readyInput();
    await user.type(input, "hi{Enter}");
    await waitFor(() => expect(answerText()).not.toBeNull());
    const root = answerText()!;
    expect(root.querySelector("strong")).toHaveTextContent("Báo giá mới nhất");
    expect(root.querySelector("code")).toHaveTextContent("BG-031");
    expect(root.querySelectorAll("ul > li")).toHaveLength(2);
    expect(root.querySelector("table th")).toHaveTextContent("Hạng mục");
    expect(root.querySelector("table td")).toHaveTextContent("Chống thấm");
    const link = root.querySelector("a")!;
    expect(link).toHaveAttribute("href", "https://example.com/bg");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toMatch(/noopener/);
    expect(root.querySelector("script")).toBeNull();
    expect(root.querySelector("img")).toBeNull();
    // The announcement has no Markdown symbols.
    expect(live().textContent).not.toMatch(/[*|`#]/);
    expect(live().textContent).toContain("Báo giá mới nhất là BG-031");
  });

  it("lays out the question, one row per tool call, then the answer, as the calls arrive", async () => {
    const s = controlledStream();
    mockStream.mockImplementation(s.gen);
    const { user } = await renderDemo();
    await user.type(await readyInput(), "hi{Enter}");
    const rowIds = () => Array.from(document.querySelectorAll("[data-row-id]")).map((el) => el.getAttribute("data-row-id"));
    expect(rowIds()).toEqual(["start", "call-1", "end"]);

    const result = (id: number): ChatEvent => ({
      type: "tool_result", call_id: id, tool: "t", ok: true, duration_ms: 5, row_count: id, sql: null, preview: "",
    });
    await s.emit({ type: "tool_call", call_id: 1, tool: "t", args: {} });
    await s.emit(result(1));
    await s.emit({ type: "tool_call", call_id: 2, tool: "t", args: { page: 2 } });
    // The second call goes above the answer row, and the call rows are titled from now on.
    expect(rowIds()).toEqual(["start", "call-1", "call-2", "end"]);
    expect(screen.getByText("Lần gọi tool 1")).toBeInTheDocument();
    expect(screen.getByText("Lần gọi tool 2")).toBeInTheDocument();
    expect(node("answer")).toHaveAttribute("data-status", "idle");
    await s.emit(result(2));
    await s.emit({ type: "answer", text: "xong" });
    expect(rowIds().at(-1)).toBe("end");
    expect(node("answer")).toHaveAttribute("data-status", "done");
    await s.end();
  });

  it("opens the tool call and the Postgres result as JSON in a popup when their nodes are clicked", async () => {
    mockStream.mockImplementation(streamOf(happyEvents()));
    const { user } = await renderDemo();
    await user.type(await readyInput(), "hi{Enter}");
    await waitFor(() => expect(node("answer")).toHaveAttribute("data-status", "done"));

    const model = within(node("model-1")).getByRole("button");
    expect(model).toHaveTextContent(`{ } ${viMessages.kb.inspect.callHint}`);
    await user.click(model);
    const call = screen.getByRole("dialog", { name: viMessages.kb.inspect.callTitle });
    expect(call).toHaveTextContent('"tool": "find_quotations"');
    expect(call).toHaveTextContent('"limit": 1');
    await user.keyboard("{Escape}");

    const db = within(node("db-1")).getByRole("button");
    expect(db).toHaveTextContent(`{ } ${viMessages.kb.inspect.resultHint}`);
    expect(node("tool-1")).toHaveTextContent("42 ms");
    await user.click(db);
    const rows = screen.getByRole("dialog", { name: viMessages.kb.inspect.resultTitle });
    expect(rows).toHaveTextContent('"sql": "SELECT 1"');
    expect(rows).toHaveTextContent('"preview": "total 1240000000"');
    await user.click(within(rows).getByRole("button", { name: viMessages.kb.inspect.close }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("draws a [slug › section] citation in the answer as a chip, and announces it as text", async () => {
    const cited = "Khoản giữ lại trả sau 12 tháng [chinh-sach-bao-hanh › Giữ lại bảo hành].";
    mockStream.mockImplementation(streamOf(happyEvents("s-1", cited)));
    const { user } = await renderDemo();
    await user.type(await readyInput(), "hi{Enter}");
    await waitFor(() => expect(answerText()).not.toBeNull());
    const chip = answerText()!.querySelector('[data-role="citation"]')!;
    expect(chip).toHaveTextContent("chinh-sach-bao-hanh › Giữ lại bảo hành");
    expect(live().textContent).toContain("chinh-sach-bao-hanh › Giữ lại bảo hành");
  });

  describe("policy questions", () => {
    const PREVIEW =
      "chinh-sach-bao-hanh › Chính sách bảo hành công trình sơn › Giữ lại bảo hành · 0.78\nxu-ly-be-mat › Xử lý bề mặt › Chà nhám · 0.70";
    const policyAnswer =
      "Khoản giữ lại trả sau 12 tháng [chinh-sach-bao-hanh › Giữ lại bảo hành]. Xem thêm [tai-lieu-la › Mục X].";
    const policyEvents = (): ChatEvent[] => [
      { type: "start", session_id: "s-1" },
      { type: "tool_call", call_id: 1, tool: "search_policies", args: { query: "giữ lại" } },
      { type: "tool_result", call_id: 1, tool: "search_policies", ok: true, duration_ms: 90, row_count: 2, sql: null, preview: PREVIEW },
      { type: "answer", text: policyAnswer },
      { type: "done", duration_ms: 900 },
    ];
    const ask = async () => {
      mockStream.mockImplementation(streamOf(policyEvents()));
      const { user } = await renderDemo();
      await user.type(await readyInput(), "hi{Enter}");
      await waitFor(() => expect(node("answer")).toHaveAttribute("data-status", "done"));
      return user;
    };

    it("labels the third node Milvus, and the chip of its popup Nguồn", async () => {
      await ask();
      expect(node("db-1")).toHaveTextContent(viMessages.kb.nodes.policyStore.label);
      expect(within(node("db-1")).getByRole("button")).toHaveTextContent(`{ } ${viMessages.kb.inspect.policyResultHint}`);
    });

    it("opens the cited document from a citation chip, highlights the section, and gives focus back on Escape", async () => {
      const user = await ask();
      const chip = screen.getByRole("button", { name: "chinh-sach-bao-hanh › Giữ lại bảo hành" });
      await user.click(chip);
      await screen.findByText(viMessages.kb.policy.synthetic);
      const cited = document.querySelectorAll('[data-role="cited-section"]');
      expect(cited).toHaveLength(1);
      expect(cited[0]).toHaveTextContent("Giữ lại bảo hành");
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(chip).toHaveFocus();
    });

    it("keeps a citation of an unknown document as plain text", async () => {
      await ask();
      expect(screen.queryByRole("button", { name: /tai-lieu-la/ })).toBeNull();
      expect(answerText()!.querySelectorAll('[data-role="citation"]')).toHaveLength(2);
    });

    it("opens the document from a source listed in the Nguồn popup", async () => {
      const user = await ask();
      await user.click(within(node("db-1")).getByRole("button"));
      const sources = within(screen.getByRole("dialog")).getAllByRole("button", { name: /›/ });
      expect(sources).toHaveLength(2);
      await user.click(sources[1]);
      await screen.findByText(viMessages.kb.policy.synthetic);
      expect(screen.getByRole("dialog", { name: "Quy trình xử lý bề mặt trước khi sơn và bả" })).toBeInTheDocument();
      expect(document.querySelectorAll('[data-role="cited-section"]')).toHaveLength(1);
    });
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
    expect(await chat().findByText(viMessages.kb.errors.model, ERROR)).toBeInTheDocument();
    expect(screen.queryByText(/RAW UPSTREAM/)).not.toBeInTheDocument();
    expect(live().textContent).toBe(viMessages.kb.errors.model);
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

  for (const locale of ["vi", "en"] as const) {
    it(`shows the rate-limited message on ChatHttpError rate_limited and lets the visitor retry (${locale})`, async () => {
      mockStream
        .mockImplementationOnce(streamOf([], new ChatHttpError("rate_limited", 429)))
        .mockImplementationOnce(streamOf(happyEvents()));
      mockMatchMedia(true);
      const { user } = await renderDemo(locale);
      const input = await readyInput(locale === "vi" ? "Câu hỏi của bạn" : "Your question");
      await user.type(input, "Một{Enter}");
      const text = (locale === "vi" ? viMessages : enMessages).kb.errors.rateLimited;
      await waitFor(() => expect(document.querySelector(ERROR.selector)).toHaveTextContent(text));
      expect(live().textContent).toBe(text);
      await waitFor(() => expect(input).toBeEnabled());
      await user.type(input, "Hai{Enter}");
      await waitFor(() => expect(answerText()).toHaveTextContent(ANSWER));
    });
  }

  it("reports a lost invite through onInviteRequired on ChatHttpError invite_required", async () => {
    mockStream.mockImplementation(streamOf([], new ChatHttpError("invite_required", 401)));
    const onInviteRequired = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <KnowledgeBaseDemo locale="vi" onInviteRequired={onInviteRequired} />
      </NextIntlClientProvider>,
    );
    const input = await readyInput();
    await user.type(input, "Một{Enter}");
    await waitFor(() => expect(onInviteRequired).toHaveBeenCalledTimes(1));
  });

  it("shows the invite-required message in place when nobody handles it", async () => {
    mockStream.mockImplementation(streamOf([], new ChatHttpError("invite_required", 401)));
    const { user } = await renderDemo();
    const input = await readyInput();
    await user.type(input, "Một{Enter}");
    await waitFor(() =>
      expect(document.querySelector(ERROR.selector)).toHaveTextContent(viMessages.kb.errors.inviteRequired),
    );
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
    await waitFor(() => expect(answerText()).toHaveTextContent(ANSWER));
    await user.type(input, "Hai{Enter}");
    expect(mockStream).toHaveBeenLastCalledWith(
      { message: "Hai", sessionId: "s-full" },
      expect.any(AbortSignal),
    );
    const button = await screen.findByRole("button", { name: "Cuộc trò chuyện mới" });
    expect(chat().getByText(viMessages.kb.errors.sessionFull, ERROR)).toBeInTheDocument();

    await user.click(button);
    expect(screen.queryByText("Một")).not.toBeInTheDocument();
    expect(screen.queryByText(viMessages.kb.errors.sessionFull)).not.toBeInTheDocument();
    expect(botBubbles()).toHaveLength(0);
    expect(node("question")).toHaveAttribute("data-status", "idle");
    expect(node("model-1")).toHaveAttribute("data-status", "idle");

    await user.type(screen.getByRole("textbox", { name: "Câu hỏi của bạn" }), "Ba{Enter}");
    expect(mockStream).toHaveBeenLastCalledWith({ message: "Ba", sessionId: null }, expect.any(AbortSignal));
  });

  it("offers five suggestions, three on quotations and two on policy, and sends a policy one as written", async () => {
    mockStream.mockImplementation(streamOf(happyEvents()));
    const { user } = await renderDemo();
    await readyInput();
    const group = screen.getByRole("group", { name: viMessages.kb.chipsLabel });
    expect(within(group).getAllByRole("button")).toHaveLength(5);
    await user.click(within(group).getByRole("button", { name: viMessages.kb.chips.c4 }));
    expect(mockStream).toHaveBeenCalledWith({ message: viMessages.kb.chips.c4, sessionId: null }, expect.any(AbortSignal));
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
    expect(await chat().findByText(viMessages.kb.errors.generic, ERROR)).toBeInTheDocument();
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
  it("moves focus to the input after a chip send", async () => {
    const s = controlledStream();
    mockStream.mockImplementation(s.gen);
    const { user } = await renderDemo();
    const input = await readyInput();
    const chip = screen.getByRole("button", { name: viMessages.kb.chips.c1 });
    await user.click(chip);
    expect(chip).toBeDisabled();
    expect(input).toHaveFocus();
  });

  it("keeps focus on the input when sending with the (then disabled) send button", async () => {
    const s = controlledStream();
    mockStream.mockImplementation(s.gen);
    const { user } = await renderDemo();
    const input = await readyInput();
    await user.type(input, "Câu hỏi");
    const send = screen.getByRole("button", { name: "Gửi" });
    await user.click(send);
    expect(send).toBeDisabled();
    expect(input).toHaveFocus();
  });

  it("focuses New conversation on session_full, then the input after starting over", async () => {
    mockStream.mockImplementation(
      streamOf([{ type: "error", code: "session_full", message: "full" }]),
    );
    const { user } = await renderDemo();
    const input = await readyInput();
    await user.type(input, "Câu hỏi{Enter}");
    const button = await screen.findByRole("button", { name: "Cuộc trò chuyện mới" });
    await waitFor(() => expect(button).toHaveFocus());
    expect(input).toBeDisabled();
    expect(live().textContent).toBe(viMessages.kb.errors.sessionFull);
    await user.click(button);
    expect(input).toBeEnabled();
    expect(input).toHaveFocus();
    expect(live().textContent).toBe("");
  });

  it("counts the 500-character limit in code points, not UTF-16 units", async () => {
    mockMatchMedia(true);
    mockStream.mockImplementation(streamOf(happyEvents()));
    const { user } = await renderDemo();
    const input = await readyInput();

    await user.click(input);
    await user.paste("😀".repeat(501));
    await user.keyboard("{Enter}");
    expect(mockStream).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");

    await user.clear(input);
    await user.paste("😀".repeat(500));
    await user.keyboard("{Enter}");
    expect(mockStream).toHaveBeenCalledWith(
      { message: "😀".repeat(500), sessionId: null },
      expect.any(AbortSignal),
    );
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText(/500 ký tự/)).not.toBeInTheDocument();
  });

  it("takes lang from the active next-intl locale, not the prop", async () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <KnowledgeBaseDemo locale="vi" />
      </NextIntlClientProvider>,
    );
    await readyInput("Your question");
    expect(container.firstElementChild).toHaveAttribute("lang", "en");
  });
});
