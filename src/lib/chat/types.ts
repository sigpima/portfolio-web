/**
 * Chat event wire contract of `POST /chat/stream`.
 * Each SSE event's JSON `data` is spread together with its `type`, so payload
 * fields sit at the same level as `type`.
 */
export type ChatErrorCode = "model" | "session_full" | "internal";

export type ChatEvent =
  | { type: "start"; session_id: string }
  | { type: "tool_call"; call_id: number; tool: string; args: Record<string, unknown> }
  | {
      type: "tool_result";
      call_id: number;
      tool: string;
      ok: boolean;
      duration_ms: number;
      row_count: number | null;
      sql: string | null;
      preview: string;
    }
  | { type: "answer"; text: string }
  | { type: "done"; duration_ms: number }
  | { type: "error"; code: ChatErrorCode; message: string };

export type ChatEventType = ChatEvent["type"];
