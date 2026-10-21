import type { NextRequest } from "next/server";
import { NOT_INVITED, parseInviteSession, type InviteSession } from "@/lib/invite/types";
import { SESSION_COOKIE } from "@/lib/server/cookies";
import { apiFetch } from "@/lib/server/portfolio-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function reply(payload: InviteSession): Response {
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}

/** Visitor session state for the browser; any failure reads as "not invited" (fail closed). */
export async function GET(request: NextRequest): Promise<Response> {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!session) return reply(NOT_INVITED);
  try {
    const upstream = await apiFetch("/v1/session", { session });
    if (!upstream.ok) return reply(NOT_INVITED);
    return reply(parseInviteSession(await upstream.json()) ?? NOT_INVITED);
  } catch {
    return reply(NOT_INVITED);
  }
}
