import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InviteSessionProvider } from "@/lib/invite/use-invite-session";
import enMessages from "../../messages/en.json";
import viMessages from "../../messages/vi.json";
import { FeedbackField } from "./FeedbackField";

const vi_ = viMessages.home.contact.feedback;
const en_ = enMessages.home.contact.feedback;
const FEATURES = { chat: true, twistfit: false, gia_pha: false };

type FeedbackReply = () => Response | Promise<Response>;

/** Stubs fetch: `/api/session` answers `invited`; `/api/feedback` answers `reply`. */
function stubFetch(invited: boolean, reply: FeedbackReply = () => Response.json({ ok: true }, { status: 201 })) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void init; // recorded by the mock, read back through `mock.calls`
    const url = String(input);
    if (url === "/api/session") return Response.json({ invited, features: invited ? FEATURES : { chat: false, twistfit: false, gia_pha: false } });
    if (url === "/api/feedback") return reply();
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function feedbackCalls(fetchMock: ReturnType<typeof stubFetch>) {
  return fetchMock.mock.calls.filter(([url]) => String(url) === "/api/feedback");
}

async function renderField(locale: "vi" | "en" = "vi") {
  const messages = locale === "vi" ? viMessages : enMessages;
  const text = locale === "vi" ? vi_ : en_;
  const view = render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <InviteSessionProvider>
        <FeedbackField email="me@example.com" />
      </InviteSessionProvider>
    </NextIntlClientProvider>,
  );
  // The note appears once the session is known.
  await screen.findByText((content) => content === text.noteInvited || content === text.noteMail);
  return { ...view, text, input: screen.getByLabelText(text.label) as HTMLInputElement, send: () => screen.getByRole("button", { name: text.submit }) };
}

const original = window.location;
beforeEach(() => {
  Object.defineProperty(window, "location", { value: { href: "" }, writable: true, configurable: true });
});
afterEach(() => {
  Object.defineProperty(window, "location", { value: original, writable: true, configurable: true });
  vi.unstubAllGlobals();
});

describe("FeedbackField with an invite link", () => {
  it("says the message is saved with the invite link, and posts it as JSON to /api/feedback", async () => {
    const fetchMock = stubFetch(true);
    const { text, input, send } = await renderField();
    expect(screen.getByText(text.noteInvited)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "  Trang rất rõ ràng  " } });
    fireEvent.click(send());
    expect(await screen.findByRole("status")).toHaveTextContent(text.sent);
    const [, init] = feedbackCalls(fetchMock)[0];
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ message: "Trang rất rõ ràng" });
    expect((init as RequestInit).credentials).toBe("same-origin");
    expect(input.value).toBe("");
    expect(window.location.href).toBe("");
  });

  it("sends once when Enter and the button are used together", async () => {
    let release: (res: Response) => void = () => {};
    const fetchMock = stubFetch(true, () => new Promise<Response>((resolve) => (release = resolve)));
    const { input, send } = await renderField();
    fireEvent.change(input, { target: { value: "một dòng" } });
    const button = send();
    fireEvent.click(button);
    fireEvent.submit(input.closest("form")!);
    fireEvent.click(button);
    expect(feedbackCalls(fetchMock)).toHaveLength(1);
    release(Response.json({ ok: true }, { status: 201 }));
    await screen.findByRole("status");
  });

  it("refuses an empty message without calling the API", async () => {
    const fetchMock = stubFetch(true);
    const { text, input, send } = await renderField();
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(send());
    expect(await screen.findByRole("alert")).toHaveTextContent(text.errors.invalid);
    expect(feedbackCalls(fetchMock)).toHaveLength(0);
  });

  it.each([
    [429, { code: "rate_limited" }, "rateLimited"],
    [422, { code: "invalid_request" }, "invalid"],
    [413, { code: "too_long" }, "invalid"],
    [503, { code: "unavailable" }, "failed"],
  ] as const)("shows a friendly message for %s and keeps the text", async (status, body, key) => {
    stubFetch(true, () => Response.json(body, { status }));
    const { text, input, send } = await renderField();
    fireEvent.change(input, { target: { value: "giữ lại" } });
    fireEvent.click(send());
    expect(await screen.findByRole("alert")).toHaveTextContent(text.errors[key]);
    expect(input.value).toBe("giữ lại");
  });

  it("shows a friendly message for a network error or a body that is not JSON", async () => {
    stubFetch(true, () => {
      throw new Error("down");
    });
    const first = await renderField();
    fireEvent.change(first.input, { target: { value: "x" } });
    fireEvent.click(first.send());
    expect(await screen.findByRole("alert")).toHaveTextContent(first.text.errors.failed);
    first.unmount();

    stubFetch(true, () => new Response("<html>", { status: 502 }));
    const second = await renderField();
    fireEvent.change(second.input, { target: { value: "x" } });
    fireEvent.click(second.send());
    expect(await screen.findByRole("alert")).toHaveTextContent(second.text.errors.failed);
  });

  it("when the invite stopped working, says so and falls back to email for the next try", async () => {
    stubFetch(true, () => Response.json({ code: "invite_required" }, { status: 401 }));
    const { text, input, send } = await renderField();
    fireEvent.change(input, { target: { value: "xin chào" } });
    fireEvent.click(send());
    expect(await screen.findByRole("alert")).toHaveTextContent(text.errors.inviteLost);
    await waitFor(() => expect(screen.getByText(text.noteMail)).toBeInTheDocument());
    fireEvent.click(send());
    expect(window.location.href).toBe(
      `mailto:me@example.com?subject=${encodeURIComponent(text.subject)}&body=${encodeURIComponent("xin chào")}`,
    );
  });
});

describe("FeedbackField without an invite link", () => {
  it("says plainly that this page sends nothing, and opens the email app instead of calling the API", async () => {
    const fetchMock = stubFetch(false);
    const { text, input, send } = await renderField();
    expect(screen.getByText(text.noteMail)).toBeInTheDocument();
    expect(screen.queryByText(text.noteInvited)).toBeNull();
    fireEvent.change(input, { target: { value: "Chào bạn & cảm ơn?" } });
    fireEvent.click(send());
    expect(window.location.href).toBe(
      `mailto:me@example.com?subject=${encodeURIComponent(text.subject)}&body=${encodeURIComponent("Chào bạn & cảm ơn?")}`,
    );
    expect(feedbackCalls(fetchMock)).toHaveLength(0);
  });

  it("limits the input to 1000 characters", async () => {
    stubFetch(false);
    const { input } = await renderField();
    expect(input.maxLength).toBe(1000);
  });

  it("works in English too", async () => {
    stubFetch(false);
    const { text, input, send } = await renderField("en");
    fireEvent.change(input, { target: { value: "hi" } });
    fireEvent.click(send());
    expect(window.location.href).toContain(encodeURIComponent(text.subject));
  });
});
