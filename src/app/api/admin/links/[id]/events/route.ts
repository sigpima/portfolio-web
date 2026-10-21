import type { NextRequest } from "next/server";
import { forwardAdmin, ID_SHAPE, jsonError, jsonResponse } from "@/lib/server/admin-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LIMIT_SHAPE = /^\d{1,3}$/;
const BEFORE_SHAPE = /^[1-9]\d{0,17}$/;

/**
 * Validated `limit` (1..200) and `before` (positive id) query, or null. Absent values are
 * left out (the API defaults to 50); a repeated parameter is rejected.
 */
function eventsQuery(params: URLSearchParams): string | null {
  const query = new URLSearchParams();
  const limits = params.getAll("limit");
  const befores = params.getAll("before");
  if (limits.length > 1 || befores.length > 1) return null;
  if (limits.length === 1) {
    const limit = limits[0];
    if (!LIMIT_SHAPE.test(limit) || Number(limit) < 1 || Number(limit) > 200) return null;
    query.set("limit", String(Number(limit)));
  }
  if (befores.length === 1) {
    if (!BEFORE_SHAPE.test(befores[0])) return null;
    query.set("before", befores[0]);
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

/** One page of a link's usage log, newest first. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!ID_SHAPE.test(id)) return jsonError("invalid_request", 422);
  const query = eventsQuery(request.nextUrl.searchParams);
  if (query === null) return jsonError("invalid_request", 422);
  return forwardAdmin(request, `/v1/admin/links/${id}/events${query}`, { method: "GET" }, async (upstream) => {
    const body: unknown = await upstream.json();
    return Array.isArray(body) ? jsonResponse(body) : null;
  });
}
