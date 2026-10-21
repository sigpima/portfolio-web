import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/cookies";
import { apiFetch, clientKeyFrom } from "@/lib/server/portfolio-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Real tokens are 43 characters; anything longer than this is rejected without a lookup.
const MAX_TOKEN_LENGTH = 512;

/**
 * Public origin for the redirect. Behind nginx the request URL may carry the container's
 * host, so SITE_URL wins when it is set and valid.
 */
function siteOrigin(request: NextRequest): string {
  const configured = process.env.SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // fall back to the request's own origin
    }
  }
  return new URL(request.url).origin;
}

function redirectTo(request: NextRequest, target: "/" | "/?invite=invalid"): NextResponse {
  // The Location never contains the token, and the token URL is never referred onwards.
  const response = NextResponse.redirect(`${siteOrigin(request)}${target}`, 307);
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function parseOpened(body: unknown): { session: string; maxAge: number } | null {
  if (!body || typeof body !== "object") return null;
  const { session, max_age_seconds: maxAge } = body as Record<string, unknown>;
  if (typeof session !== "string" || !session) return null;
  if (typeof maxAge !== "number" || !Number.isInteger(maxAge) || maxAge <= 0) return null;
  return { session, maxAge };
}

/**
 * Invite entry `/i/<token>`: exchanges the token for a visitor session cookie. Every failure
 * (unknown/revoked/expired token, rate limit, API down) looks the same: `/?invite=invalid`.
 * Neither the token nor this URL is ever logged.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  try {
    const { token } = await params;
    if (!token || token.length > MAX_TOKEN_LENGTH) return redirectTo(request, "/?invite=invalid");

    const upstream = await apiFetch("/v1/invites/open", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      clientKey: clientKeyFrom(request),
    });
    if (upstream.status !== 200) return redirectTo(request, "/?invite=invalid");
    const opened = parseOpened(await upstream.json());
    if (!opened) return redirectTo(request, "/?invite=invalid");

    const response = redirectTo(request, "/");
    response.cookies.set(SESSION_COOKIE, opened.session, sessionCookieOptions(opened.maxAge));
    return response;
  } catch {
    // Deliberately silent: the error could carry the token or URL.
    return redirectTo(request, "/?invite=invalid");
  }
}
