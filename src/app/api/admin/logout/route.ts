import type { NextRequest } from "next/server";
import { apiFetch } from "@/lib/server/portfolio-api";
import {
  adminSessionFrom,
  clearAdminCookie,
  isJsonContentType,
  jsonError,
  jsonResponse,
  rejectCrossSite,
} from "@/lib/server/admin-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Ends the admin session on the API (best effort) and clears the cookie. Same-origin JSON
 * POST only, like every admin POST: a cross-site form cannot log the owner out.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return jsonError("unsupported_media_type", 415);
  }
  const adminSession = adminSessionFrom(request);
  if (adminSession) {
    try {
      const upstream = await apiFetch("/v1/admin/logout", { method: "POST", adminSession });
      void upstream.body?.cancel().catch(() => {});
    } catch {
      // ignored: the cookie is cleared anyway and the API session expires on its own
    }
  }
  return clearAdminCookie(jsonResponse({ ok: true }));
}
