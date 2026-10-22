import type { NextRequest } from "next/server";
import { isJsonContentType, jsonError, readBodyBytesCapped, rejectCrossSite } from "@/lib/server/admin-proxy";
import { forwardTwistfit, requireTwistfitSession } from "@/lib/server/twistfit-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The body is a few dozen bytes; portfolio-api enforces the same cap and validates it. */
const MAX_BODY_BYTES = 4 * 1024;

/** Start a Twistfit job. The body goes upstream untouched: it is neither parsed nor logged here. */
export async function POST(request: NextRequest): Promise<Response> {
  // A browser that says the request is not same-origin (another site's page) is refused.
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  // No invite session: refuse before the content type or body is looked at.
  const denied = requireTwistfitSession(request);
  if (denied) return denied;
  // Only JSON: a cross-site "simple" POST (text/plain, form) must not reach the API.
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return jsonError("unsupported_media_type", 415);
  }
  const body = await readBodyBytesCapped(request, MAX_BODY_BYTES);
  if (body === null) return jsonError("too_long", 413);
  return forwardTwistfit(request, "/v1/twistfit/run", { method: "POST", body });
}
