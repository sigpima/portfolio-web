import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/server/cookies";
import { flagKeyMismatch, jsonError, jsonResponse, readTextCapped, SESSION_SHAPE, upstreamCode } from "@/lib/server/admin-proxy";
import { apiFetch } from "@/lib/server/portfolio-api";

/**
 * Shared plumbing of the `/api/twistfit/*` route handlers: they only forward to `portfolio-api`
 * with the invite session taken from the HttpOnly `pf_session` cookie (never from a header the
 * browser sent), and relay only `{code}` on errors. Nothing here parses or logs a request body.
 */

/** Time portfolio-api gets to answer with response headers. */
const CONNECT_TIMEOUT_MS = 15_000;
/** Time to read an upstream JSON body once its headers have arrived. */
const BODY_TIMEOUT_MS = 5_000;
/** Cap on an upstream JSON answer (the catalog is the largest, a few KB). */
const MAX_JSON_BYTES = 256 * 1024;
/** Cache lifetime of images: private (per session), matching portfolio-api. */
const IMAGE_CACHE_CONTROL = "private, max-age=3600";
/** Image types portfolio-api serves; anything else upstream is refused (no SVG/HTML to the browser). */
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
/**
 * Upstream error (status -> codes) pairs that are relayed, exactly those portfolio-api's
 * twistfit router can emit; any other pair becomes 503 `demo_disabled`.
 */
const RELAYED_ERRORS: ReadonlyMap<number, ReadonlySet<string>> = new Map([
  [401, new Set(["invite_required"])],
  [404, new Set(["not_found"])],
  [413, new Set(["too_long"])],
  [422, new Set(["invalid_request"])],
  [429, new Set(["busy", "twistfit_limit"])],
  [503, new Set(["demo_disabled"])],
]);

/** Shape of a job/result id and of an asset id (what portfolio-api issues or the catalog holds). */
export const TWISTFIT_ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/;
export const TWISTFIT_ASSET_KINDS: ReadonlySet<string> = new Set(["models", "items"]);

export type TwistfitForwardOptions = {
  method?: "GET" | "POST";
  /** Raw request body to send as `application/json` (POST only); forwarded byte for byte. */
  body?: Uint8Array;
  /** The answer is an image: stream it instead of reading JSON. */
  binary?: boolean;
};

/** The invite session from the `pf_session` cookie, or null when absent or malformed. */
function sessionFrom(request: NextRequest): string | null {
  const value = request.cookies.get(SESSION_COOKIE)?.value;
  return value && SESSION_SHAPE.test(value) ? value : null;
}

/** The 401 `invite_required` to answer when there is no valid session cookie, else null. */
export function requireTwistfitSession(request: NextRequest): Response | null {
  return sessionFrom(request) ? null : jsonError("invite_required", 401);
}

/** 404 for a path parameter that cannot name anything, without contacting the API. */
export function twistfitNotFound(): Response {
  return jsonError("not_found", 404);
}

function mediaType(res: Response): string {
  return (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
}

/** Map a non-2xx portfolio-api answer to what the browser should see: `{code}` or 503. */
async function relayError(upstream: Response): Promise<Response> {
  const code = await upstreamCode(upstream);
  if (upstream.status === 401 && code === "unauthorized") {
    // The two services disagree on the internal key: an operator problem, not a visitor one.
    flagKeyMismatch();
    return jsonError("demo_disabled", 503);
  }
  if (code === null || !RELAYED_ERRORS.get(upstream.status)?.has(code)) {
    return jsonError("demo_disabled", 503);
  }
  // Relay only the code, never other fields the upstream body may carry.
  return jsonError(code, upstream.status);
}

/**
 * Forward one Twistfit call. No valid session cookie -> 401 `invite_required` before anything
 * else (no API call). A JSON 2xx is relayed as no-store JSON; with `binary`, only an
 * image/png|jpeg|webp answer is streamed (private cache header). Errors become `{code}` for the
 * known (status, code) pairs and 503 `demo_disabled` for everything else.
 */
export async function forwardTwistfit(
  request: NextRequest,
  path: string,
  opts: TwistfitForwardOptions = {},
): Promise<Response> {
  const session = sessionFrom(request);
  if (!session) return jsonError("invite_required", 401);

  // Aborts the upstream request when the client goes away, or when a phase takes too long.
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (request.signal.aborted) abort();
  else request.signal.addEventListener("abort", abort, { once: true });
  const detach = () => request.signal.removeEventListener("abort", abort);
  let timer = setTimeout(abort, CONNECT_TIMEOUT_MS);

  const method = opts.method ?? "GET";
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  headers.accept = opts.binary ? "image/*" : "application/json";

  let upstream: Response;
  try {
    upstream = await apiFetch(path, {
      method,
      headers,
      body: opts.body as BodyInit | undefined,
      session,
      signal: controller.signal,
    });
  } catch {
    detach();
    return jsonError("demo_disabled", 503);
  } finally {
    clearTimeout(timer);
  }

  const discard = () => {
    detach();
    void upstream.body?.cancel().catch(() => {});
    controller.abort();
  };

  try {
    // From here on, reading the body is bounded by its own short timer.
    timer = setTimeout(abort, BODY_TIMEOUT_MS);

    if (!upstream.ok) {
      const res = await relayError(upstream);
      return controller.signal.aborted ? jsonError("demo_disabled", 503) : res;
    }

    if (opts.binary) {
      if (!upstream.body || !IMAGE_TYPES.has(mediaType(upstream))) {
        discard();
        return jsonError("demo_disabled", 503);
      }
      // Streaming: no total timeout, the client-abort listener stays attached.
      clearTimeout(timer);
      return new Response(upstream.body, {
        status: 200,
        headers: {
          "content-type": mediaType(upstream),
          "cache-control": IMAGE_CACHE_CONTROL,
          "x-content-type-options": "nosniff",
        },
      });
    }

    if (mediaType(upstream) !== "application/json") {
      discard();
      return jsonError("demo_disabled", 503);
    }
    const body: unknown = JSON.parse(await readTextCapped(upstream, MAX_JSON_BYTES));
    if (controller.signal.aborted || body === null || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("demo_disabled", 503);
    }
    return jsonResponse(body, upstream.status === 202 ? 202 : 200);
  } catch {
    discard();
    return jsonError("demo_disabled", 503);
  } finally {
    clearTimeout(timer);
    if (!opts.binary || !upstream.ok) detach();
  }
}
