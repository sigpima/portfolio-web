import type { NextRequest } from "next/server";
import {
  forwardAdmin,
  isJsonContentType,
  jsonError,
  jsonResponse,
  readBodyCapped,
} from "@/lib/server/admin-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A link name is at most 80 characters; 4 KB leaves room for the optional fields. */
const MAX_BODY_BYTES = 4 * 1024;

/** All invite links with their status and usage counts. */
export async function GET(request: NextRequest): Promise<Response> {
  return forwardAdmin(request, "/v1/admin/links", { method: "GET" }, async (upstream) => {
    const body: unknown = await upstream.json();
    return Array.isArray(body) ? jsonResponse(body) : null;
  });
}

/** Create a link; the reply carries the token, shown to the owner exactly once. */
export async function POST(request: NextRequest): Promise<Response> {
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return jsonError("unsupported_media_type", 415);
  }
  const raw = await readBodyCapped(request, MAX_BODY_BYTES);
  if (raw === null) return jsonError("too_long", 413);
  return forwardAdmin(
    request,
    "/v1/admin/links",
    { method: "POST", headers: { "content-type": "application/json" }, body: raw },
    async (upstream) => {
      const body = (await upstream.json()) as Record<string, unknown> | null;
      if (!body || typeof body.id !== "number" || typeof body.name !== "string" || typeof body.token !== "string") {
        return null;
      }
      return jsonResponse({ id: body.id, name: body.name, token: body.token }, 201);
    },
  );
}
