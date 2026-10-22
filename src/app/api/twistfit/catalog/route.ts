import type { NextRequest } from "next/server";
import { forwardTwistfit } from "@/lib/server/twistfit-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The Twistfit catalog (garments and models) for the visitor's invite session. */
export async function GET(request: NextRequest): Promise<Response> {
  return forwardTwistfit(request, "/v1/twistfit/catalog");
}
