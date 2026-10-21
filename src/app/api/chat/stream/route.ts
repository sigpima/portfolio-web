import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/server/cookies";
import { rejectCrossSite } from "@/lib/server/admin-proxy";
import { apiFetch } from "@/lib/server/portfolio-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Defensive cap; portfolio-api and the chat service enforce their own limits too. */
const MAX_BODY_BYTES = 32 * 1024;
/** Time portfolio-api gets to answer with response headers; the stream itself has no cap. */
const CONNECT_TIMEOUT_MS = 15_000;
/** Time to read a (tiny) upstream error body once its headers have arrived. */
const ERROR_BODY_TIMEOUT_MS = 5_000;
/** Cap on an upstream error body read for passthrough (real ones are a few dozen bytes). */
const MAX_ERROR_BODY_BYTES = 16 * 1024;
/** Upstream statuses (besides a 2xx stream) that are relayed with their JSON body. */
const PASSTHROUGH_STATUSES = new Set([401, 413, 415, 422, 429, 503]);
/** Visible ASCII only (what portfolio-api issues); anything else cannot be a real session. */
const SESSION_SHAPE = /^[\x21-\x7e]{1,512}$/;

let warnedKeyMismatch = false;

function jsonError(code: string, status: number): Response {
  return Response.json({ code }, { status, headers: { "cache-control": "no-store" } });
}

/** Read the request body as bytes, or return null if it exceeds `limit` bytes. */
async function readBodyCapped(request: Request, limit: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return new Uint8Array(0);
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
  return bytes;
}

/**
 * Read at most `limit` bytes of a response body as text (the rest is discarded). Aborting
 * `signal` cancels the read: it returns what arrived so far instead of waiting for more.
 */
async function readTextCapped(res: Response, limit: number, signal: AbortSignal): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const cancel = () => void reader.cancel().catch(() => {});
  if (signal.aborted) cancel();
  else signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    cancel();
  }
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, limit));
}

/** True for `application/json`, case-insensitive, with optional parameters (e.g. charset). */
function isJsonContentType(value: string | null): boolean {
  if (!value) return false;
  return value.split(";")[0].trim().toLowerCase() === "application/json";
}

function codeOf(body: unknown): string | null {
  if (body && typeof body === "object" && "code" in body && typeof body.code === "string") {
    return body.code;
  }
  return null;
}

/** Map a non-2xx portfolio-api answer to what the browser should see. */
async function relayError(upstream: Response, signal: AbortSignal): Promise<Response> {
  const text = await readTextCapped(upstream, MAX_ERROR_BODY_BYTES, signal);
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // unexpected body: handled below
  }
  const code = codeOf(body);
  if (upstream.status === 401 && code === "unauthorized") {
    // The two services disagree on the internal key: an operator problem, not a visitor one.
    if (!warnedKeyMismatch) {
      warnedKeyMismatch = true;
      console.error("[portfolio-web] portfolio-api rejected the internal key: PORTFOLIO_API_KEY does not match.");
    }
    return jsonError("demo_disabled", 503);
  }
  if (!PASSTHROUGH_STATUSES.has(upstream.status) || code === null) {
    return jsonError("demo_disabled", 503);
  }
  if (upstream.status === 401 && code !== "invite_required") return jsonError("demo_disabled", 503);
  // Relay only the code, never other fields the upstream body may carry.
  return jsonError(code, upstream.status);
}

/** `relayError` bounded by its own short timeout (which also aborts the upstream request). */
async function readErrorResponse(upstream: Response, controller: AbortController): Promise<Response> {
  const timer = setTimeout(() => controller.abort(), ERROR_BODY_TIMEOUT_MS);
  try {
    const res = await relayError(upstream, controller.signal);
    return controller.signal.aborted ? jsonError("demo_disabled", 503) : res;
  } catch {
    return jsonError("demo_disabled", 503);
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  // A browser that says the request is not same-origin (another site's page) is refused.
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  // Only JSON: a cross-site "simple" POST (text/plain, form) must not reach the API.
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return jsonError("unsupported_media_type", 415);
  }
  // No invite session: refuse before reading the body or contacting anything.
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!session || !SESSION_SHAPE.test(session)) return jsonError("invite_required", 401);

  // Never log the body: it contains the visitor's question.
  const body = await readBodyCapped(request, MAX_BODY_BYTES);
  if (body === null) return jsonError("too_long", 413);

  // Aborts the upstream request when the client goes away, or when the headers take too long.
  // The timer is cleared as soon as headers arrive: a started stream has no total timeout.
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (request.signal.aborted) abort();
  else request.signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, CONNECT_TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await apiFetch("/v1/chat/stream", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: body as BodyInit,
      session,
      signal: controller.signal,
    });
  } catch {
    request.signal.removeEventListener("abort", abort);
    return jsonError("demo_disabled", 503);
  } finally {
    clearTimeout(timer);
  }

  if (!upstream.ok) {
    try {
      return await readErrorResponse(upstream, controller);
    } finally {
      request.signal.removeEventListener("abort", abort);
    }
  }

  const contentType = upstream.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!upstream.body || contentType !== "text/event-stream") {
    // A 2xx that is not an event stream (misrouted JSON/HTML) is not something to relay.
    request.signal.removeEventListener("abort", abort);
    void upstream.body?.cancel().catch(() => {});
    controller.abort();
    return jsonError("demo_disabled", 503);
  }

  // The client-abort listener stays attached for the stream's lifetime.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
