import type { NextRequest } from "next/server";
import { apiFetch } from "@/lib/server/portfolio-api";
import { adminSessionFrom, clearAdminCookie, jsonResponse } from "@/lib/server/admin-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Ends the admin session on the API (best effort) and always clears the cookie. */
export async function POST(request: NextRequest): Promise<Response> {
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
