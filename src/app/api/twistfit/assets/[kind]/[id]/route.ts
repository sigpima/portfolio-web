import type { NextRequest } from "next/server";
import {
  forwardTwistfit,
  requireTwistfitSession,
  twistfitNotFound,
  TWISTFIT_ASSET_KINDS,
  TWISTFIT_ID_SHAPE,
} from "@/lib/server/twistfit-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** One catalog image (a garment or a model). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
): Promise<Response> {
  // The session first: without one, the params are not looked at.
  const denied = requireTwistfitSession(request);
  if (denied) return denied;
  const { kind, id } = await params;
  if (!TWISTFIT_ASSET_KINDS.has(kind) || !TWISTFIT_ID_SHAPE.test(id)) return twistfitNotFound();
  return forwardTwistfit(request, `/v1/twistfit/assets/${kind}/${id}`, { binary: true });
}
