import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, sessionCookieOptions } from "@/lib/server/cookies";
import { apiFetch, type ApiFetchInit } from "@/lib/server/portfolio-api";

/**
 * Shared plumbing of the `/api/admin/*` route handlers: they only forward to `portfolio-api`
 * with the admin session taken from the HttpOnly `pf_admin` cookie (never from a header the
 * browser sent), and relay only `{code}` on errors.
 */

/** Sliding idle timeout of the admin session (seconds), same as portfolio-api's. */
export const ADMIN_MAX_AGE = 7200;
/** Upstream error statuses whose `{code}` is relayed as is. */
const RELAYED_STATUSES = new Set([401, 404, 422, 429]);
/** Cap on an upstream error body read (real ones are a few dozen bytes). */
const MAX_ERROR_BODY_BYTES = 16 * 1024;
/** Visible ASCII only (what portfolio-api issues); anything else cannot be a real session. */
const SESSION_SHAPE = /^[\x21-\x7e]{1,512}$/;
/** Link ids are SQLite integers. */
export const ID_SHAPE = /^\d{1,18}$/;

let warnedKeyMismatch = false;

export function jsonResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function jsonError(code: string, status: number): NextResponse {
  return jsonResponse({ code }, status);
}

/** True for `application/json`, case-insensitive, with optional parameters (e.g. charset). */
export function isJsonContentType(value: string | null): boolean {
  if (!value) return false;
  return value.split(";")[0].trim().toLowerCase() === "application/json";
}

/** Read the request body as text, or return null if it exceeds `limit` bytes. */
export async function readBodyCapped(request: Request, limit: number): Promise<string | null> {
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
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Read at most `limit` bytes of a response body as text; the rest is discarded. */
async function readTextCapped(res: Response, limit: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
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
    void reader.cancel().catch(() => {});
  }
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, limit));
}

function codeOf(body: unknown): string | null {
  if (body && typeof body === "object" && "code" in body && typeof body.code === "string") {
    return body.code;
  }
  return null;
}

/** Read an upstream error body and return its `code`, or null. */
export async function upstreamCode(upstream: Response): Promise<string | null> {
  try {
    return codeOf(JSON.parse(await readTextCapped(upstream, MAX_ERROR_BODY_BYTES)));
  } catch {
    return null;
  }
}

/** One operator-facing flag when portfolio-api rejects the internal key (no secrets in it). */
export function flagKeyMismatch(): void {
  if (warnedKeyMismatch) return;
  warnedKeyMismatch = true;
  console.error("[portfolio-web] portfolio-api rejected the internal key: PORTFOLIO_API_KEY does not match.");
}

/** The admin session from the `pf_admin` cookie, or null when absent or malformed. */
export function adminSessionFrom(request: NextRequest): string | null {
  const value = request.cookies.get(ADMIN_COOKIE)?.value;
  return value && SESSION_SHAPE.test(value) ? value : null;
}

export function clearAdminCookie(response: NextResponse): NextResponse {
  response.cookies.set(ADMIN_COOKIE, "", sessionCookieOptions(0));
  return response;
}

/**
 * Forward one admin call. No cookie -> 401 `admin_required` without contacting the API. A 2xx
 * goes through `onSuccess` (which builds the browser response) and slides the cookie; errors
 * become `{code}` only.
 */
export async function forwardAdmin(
  request: NextRequest,
  path: string,
  init: Omit<ApiFetchInit, "adminSession" | "session" | "clientKey">,
  onSuccess: (upstream: Response) => Promise<NextResponse | null>,
): Promise<NextResponse> {
  const adminSession = adminSessionFrom(request);
  if (!adminSession) return jsonError("admin_required", 401);

  let upstream: Response;
  try {
    upstream = await apiFetch(path, { ...init, adminSession });
  } catch {
    return jsonError("unavailable", 503);
  }

  if (upstream.ok) {
    let response: NextResponse | null;
    try {
      response = await onSuccess(upstream);
    } catch {
      response = null;
    }
    if (!response) return jsonError("unavailable", 503);
    // portfolio-api slid its session on this call: the cookie slides with it.
    response.cookies.set(ADMIN_COOKIE, adminSession, sessionCookieOptions(ADMIN_MAX_AGE));
    return response;
  }

  const code = await upstreamCode(upstream);
  if (upstream.status === 401 && code === "unauthorized") {
    flagKeyMismatch();
    return jsonError("unavailable", 503);
  }
  if (upstream.status === 401) {
    if (code !== "admin_required") return jsonError("unavailable", 503);
    return clearAdminCookie(jsonError("admin_required", 401));
  }
  if (!RELAYED_STATUSES.has(upstream.status) || code === null) return jsonError("unavailable", 503);
  return jsonError(code, upstream.status);
}
