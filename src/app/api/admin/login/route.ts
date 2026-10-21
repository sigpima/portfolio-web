import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, sessionCookieOptions } from "@/lib/server/cookies";
import { apiFetch, clientKeyFrom } from "@/lib/server/portfolio-api";
import {
  flagKeyMismatch,
  isJsonContentType,
  jsonError,
  jsonResponse,
  readBodyCapped,
  rejectCrossSite,
  upstreamCode,
} from "@/lib/server/admin-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 4 * 1024;

function parsePassword(raw: string): string | null {
  try {
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const { password } = body as Record<string, unknown>;
    return typeof password === "string" ? password : null;
  } catch {
    return null;
  }
}

function parseLogin(body: unknown): { session: string; maxAge: number } | null {
  if (!body || typeof body !== "object") return null;
  const { admin_session: session, max_age_seconds: maxAge } = body as Record<string, unknown>;
  if (typeof session !== "string" || !/^[\x21-\x7e]{1,512}$/.test(session)) return null;
  if (typeof maxAge !== "number" || !Number.isInteger(maxAge) || maxAge <= 0) return null;
  return { session, maxAge };
}

/** Owner login. The password is never logged nor echoed; errors carry only a `code`. */
export async function POST(request: NextRequest): Promise<Response> {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return jsonError("unsupported_media_type", 415);
  }
  const raw = await readBodyCapped(request, MAX_BODY_BYTES);
  if (raw === null) return jsonError("too_long", 413);
  const password = parsePassword(raw);
  if (password === null) return jsonError("invalid_request", 422);

  let clientKey: string;
  try {
    clientKey = clientKeyFrom(request);
  } catch {
    return jsonError("server_misconfigured", 503);
  }

  try {
    const upstream = await apiFetch("/v1/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
      clientKey,
    });
    if (upstream.status === 200) {
      const login = parseLogin(await upstream.json());
      if (!login) return jsonError("unavailable", 503);
      const response = jsonResponse({ ok: true });
      response.cookies.set(ADMIN_COOKIE, login.session, sessionCookieOptions(login.maxAge));
      return response;
    }
    const code = await upstreamCode(upstream);
    if (upstream.status === 401 && code === "unauthorized") {
      flagKeyMismatch();
      return jsonError("unavailable", 503);
    }
    if (upstream.status === 401 && code === "invalid_credentials") return jsonError(code, 401);
    if (upstream.status === 429 && code === "rate_limited") return jsonError(code, 429);
    return jsonError("unavailable", 503);
  } catch {
    // Deliberately silent: never risk logging anything derived from the request body.
    return jsonError("unavailable", 503);
  }
}
