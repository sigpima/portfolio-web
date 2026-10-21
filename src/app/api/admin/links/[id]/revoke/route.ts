import type { NextRequest } from "next/server";
import {
  forwardAdmin,
  ID_SHAPE,
  isJsonContentType,
  jsonError,
  jsonResponse,
  rejectCrossSite,
  requireAdminSession,
} from "@/lib/server/admin-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Revoke one link (effective immediately on the API side). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  // The session first: without one, nothing else about the request is looked at.
  const session = requireAdminSession(request);
  if (typeof session !== "string") return session;
  // JSON only, like every other admin POST: a cross-site form post cannot reach the API.
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return jsonError("unsupported_media_type", 415);
  }
  const { id } = await params;
  if (!ID_SHAPE.test(id)) return jsonError("invalid_request", 422);
  return forwardAdmin(request, `/v1/admin/links/${id}/revoke`, { method: "POST" }, async (upstream) => {
    void upstream.body?.cancel().catch(() => {});
    return jsonResponse({ ok: true });
  });
}
