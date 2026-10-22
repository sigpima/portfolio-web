import type { NextRequest } from "next/server";
import {
  forwardTwistfit,
  requireTwistfitSession,
  twistfitNotFound,
  TWISTFIT_ID_SHAPE,
} from "@/lib/server/twistfit-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The finished image of a Twistfit job. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = requireTwistfitSession(request);
  if (denied) return denied;
  const { id } = await params;
  if (!TWISTFIT_ID_SHAPE.test(id)) return twistfitNotFound();
  return forwardTwistfit(request, `/v1/twistfit/results/${id}`, { binary: true });
}
