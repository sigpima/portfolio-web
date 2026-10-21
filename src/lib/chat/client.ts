import { parseSse } from "./sse";
import type { ChatEvent } from "./types";

export class ChatHttpError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(`chat request failed: ${status} ${code}`);
    this.name = "ChatHttpError";
    this.code = code;
    this.status = status;
  }
}

async function errorCode(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && "code" in body && typeof body.code === "string") {
      return body.code;
    }
  } catch {
    // fall through
  }
  return "internal";
}

export async function* streamChat(
  req: { message: string; sessionId: string | null },
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({ message: req.message, session_id: req.sessionId }),
    signal,
  });
  if (!res.ok) throw new ChatHttpError(await errorCode(res), res.status);
  if (!res.body) throw new ChatHttpError("internal", res.status);
  yield* parseSse(res.body);
}

export async function fetchChatStatus(): Promise<{ enabled: boolean }> {
  try {
    const res = await fetch("/api/chat/status", { cache: "no-store" });
    if (!res.ok) return { enabled: false };
    const body: unknown = await res.json();
    const enabled =
      !!body && typeof body === "object" && "enabled" in body && body.enabled === true;
    return { enabled };
  } catch {
    return { enabled: false };
  }
}
