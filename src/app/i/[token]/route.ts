import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/cookies";
import { apiFetch, clientKeyFrom } from "@/lib/server/portfolio-api";
import { isPreviewBot } from "@/lib/server/preview-bots";
import { configuredSiteOrigin } from "@/lib/server/site-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Real tokens are 43 characters; anything longer than this is rejected without a lookup.
const MAX_TOKEN_LENGTH = 512;
/** Tokens are base64url (`secrets.token_urlsafe`); anything else cannot be one. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]+$/;

type Target = "/?invite=ok" | "/?invite=invalid" | "/?invite=unavailable";

/**
 * Public origin for the redirect. Behind nginx the request URL may carry the container's
 * host, so SITE_URL wins when it is a usable absolute URL (never e.g. `CHANGE_ME`).
 */
function siteOrigin(request: NextRequest): string {
  return configuredSiteOrigin() ?? new URL(request.url).origin;
}

function redirectTo(request: NextRequest, target: Target): NextResponse {
  // The Location never contains the token, and the token URL is never referred onwards.
  const response = NextResponse.redirect(`${siteOrigin(request)}${target}`, 307);
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/** Tiny bilingual page for previewers and HEAD: no token, no OG tags, nothing to index. */
const NEUTRAL_PAGE = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Link mời / Invite link</title></head>
<body><p>Trang này cần liên kết mời hợp lệ.</p><p lang="en">This page needs a valid invite link.</p></body></html>
`;

function neutralPage(withBody: boolean): NextResponse {
  return new NextResponse(withBody ? NEUTRAL_PAGE : null, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}

function parseOpened(body: unknown): { session: string; maxAge: number } | null {
  if (!body || typeof body !== "object") return null;
  const { session, max_age_seconds: maxAge } = body as Record<string, unknown>;
  if (typeof session !== "string" || !session) return null;
  if (typeof maxAge !== "number" || !Number.isInteger(maxAge) || maxAge <= 0) return null;
  return { session, maxAge };
}

/**
 * Invite entry `/i/<token>`: exchanges the token for a visitor session cookie and lands on
 * `/?invite=ok`. A token that is malformed or unknown/revoked/expired (API 404) lands on
 * `/?invite=invalid` (one uniform answer, no reason); anything else going wrong (rate limit,
 * API down or misconfigured, unexpected reply) lands on `/?invite=unavailable`, so an outage
 * never reads as "your link is dead". Link previewers and crawlers (see `isPreviewBot`) get a
 * neutral page and never reach the API. Neither the token nor this URL is ever logged.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  if (isPreviewBot(request.headers.get("user-agent"))) return neutralPage(true);
  try {
    const { token } = await params;
    if (!token || token.length > MAX_TOKEN_LENGTH || !TOKEN_SHAPE.test(token)) {
      return redirectTo(request, "/?invite=invalid");
    }

    const upstream = await apiFetch("/v1/invites/open", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      clientKey: clientKeyFrom(request),
    });
    if (upstream.status === 404) {
      void upstream.body?.cancel().catch(() => {});
      return redirectTo(request, "/?invite=invalid");
    }
    if (upstream.status !== 200) {
      void upstream.body?.cancel().catch(() => {});
      return redirectTo(request, "/?invite=unavailable");
    }
    const opened = parseOpened(await upstream.json());
    if (!opened) return redirectTo(request, "/?invite=unavailable");

    const response = redirectTo(request, "/?invite=ok");
    response.cookies.set(SESSION_COOKIE, opened.session, sessionCookieOptions(opened.maxAge));
    return response;
  } catch {
    // Deliberately silent: the error could carry the token or URL.
    return redirectTo(request, "/?invite=unavailable");
  }
}

/** HEAD never opens an invite (previewers and link checkers use it): the neutral page's headers. */
export async function HEAD(): Promise<NextResponse> {
  return neutralPage(false);
}
