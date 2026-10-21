// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatHttpError, fetchChatStatus, streamChat } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamChat", () => {
  it("throws ChatHttpError with the code from the JSON body on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ code: "too_long" }, { status: 422 })),
    );
    const gen = streamChat({ message: "x", sessionId: null });
    const err = await gen.next().then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ChatHttpError);
    expect((err as ChatHttpError).code).toBe("too_long");
    expect((err as ChatHttpError).status).toBe(422);
  });

  it("defaults the code to internal when the body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    await expect(streamChat({ message: "x", sessionId: null }).next()).rejects.toMatchObject({
      code: "internal",
      status: 500,
    });
  });

  it("POSTs JSON to /api/chat/stream and yields parsed events", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response('event: answer\ndata: {"text":"ok"}\n\n', {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = [];
    for await (const ev of streamChat({ message: "hỏi", sessionId: "s1" })) out.push(ev);
    expect(out).toEqual([{ type: "answer", text: "ok" }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/chat/stream");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual({ message: "hỏi", session_id: "s1" });
  });
});

describe("fetchChatStatus", () => {
  it("returns enabled:false when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network");
      }),
    );
    await expect(fetchChatStatus()).resolves.toEqual({ enabled: false });
  });

  it("returns enabled:false on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    await expect(fetchChatStatus()).resolves.toEqual({ enabled: false });
  });

  it("returns the status JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ enabled: true })));
    await expect(fetchChatStatus()).resolves.toEqual({ enabled: true });
  });
});
