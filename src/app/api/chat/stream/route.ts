import { chatBackendUrl } from "../backend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Defensive cap; the backend itself rejects bodies over 16 KB. */
const MAX_BODY_BYTES = 32 * 1024;

function jsonError(code: string, status: number): Response {
  return Response.json({ code }, { status, headers: { "cache-control": "no-store" } });
}

/** Read the request body as text, or return null if it exceeds `limit` bytes. */
async function readBodyCapped(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function POST(request: Request): Promise<Response> {
  // Never log the body: it contains the visitor's question.
  const body = await readBodyCapped(request, MAX_BODY_BYTES);
  if (body === null) return jsonError("too_long", 413);

  let upstream: Response;
  try {
    upstream = await fetch(`${chatBackendUrl()}/chat/stream`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body,
      signal: request.signal,
      cache: "no-store",
    });
  } catch {
    return jsonError("demo_disabled", 503);
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return new Response(text, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
