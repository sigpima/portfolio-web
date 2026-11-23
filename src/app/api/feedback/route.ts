import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/server/cookies";
import {
  SESSION_SHAPE,
  flagKeyMismatch,
  isJsonContentType,
  jsonError,
  jsonResponse,
  readBodyBytesCapped,
  rejectCrossSite,
  upstreamCode,
} from "@/lib/server/admin-proxy";
import { apiFetch } from "@/lib/server/portfolio-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A message is at most 1000 characters (up to 4 bytes each) plus the JSON around it. */
const MAX_BODY_BYTES = 8 * 1024;
/** (status, code) pairs of portfolio-api's `/v1/feedback` that the browser may see. */
const RELAYED = new Map<number, string>([
  [401, "invite_required"],
  [422, "invalid_request"],
  [429, "rate_limited"],
]);

/**
 * Stores one piece of feedback against the visitor's invite link (portfolio-api keeps it).
 * Only an invite session may send: no session, no body read and no API call.
 */
export async function POST(request: NextRequest): Promise<Response> {
  // A browser that says the request is not same-origin (another site's page) is refused.
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!session || !SESSION_SHAPE.test(session)) return jsonError("invite_required", 401);
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return jsonError("unsupported_media_type", 415);
  }
  const body = await readBodyBytesCapped(request, MAX_BODY_BYTES);
  if (body === null) return jsonError("too_long", 413);

  let upstream: Response;
  try {
    upstream = await apiFetch("/v1/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body as BodyInit,
      session,
    });
  } catch {
    return jsonError("unavailable", 503);
  }

  if (upstream.status === 201) {
    void upstream.body?.cancel().catch(() => {});
    return jsonResponse({ ok: true }, 201);
  }
  const code = await upstreamCode(upstream);
  if (upstream.status === 401 && code === "unauthorized") {
    flagKeyMismatch();
    return jsonError("unavailable", 503);
  }
  if (code !== null && RELAYED.get(upstream.status) === code) return jsonError(code, upstream.status);
  return jsonError("unavailable", 503);
}
