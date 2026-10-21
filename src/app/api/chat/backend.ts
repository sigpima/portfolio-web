/** Base URL of the chat backend; server-side only. */
export function chatBackendUrl(): string {
  return (process.env.CHAT_BACKEND_URL || "http://chat:8003").replace(/\/+$/, "");
}
