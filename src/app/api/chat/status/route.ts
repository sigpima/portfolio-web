import { chatBackendUrl } from "../backend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DISABLED = { enabled: false } as const;

function reply(payload: unknown): Response {
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}

export async function GET(): Promise<Response> {
  try {
    const upstream = await fetch(`${chatBackendUrl()}/chat/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!upstream.ok) return reply(DISABLED);
    const body: unknown = await upstream.json();
    const enabled =
      !!body && typeof body === "object" && "enabled" in body && body.enabled === true;
    return reply({ enabled });
  } catch {
    return reply(DISABLED);
  }
}
