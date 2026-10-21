import { apiFetch } from "@/lib/server/portfolio-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DISABLED = { enabled: false } as const;

function reply(payload: unknown): Response {
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}

/** Whether the chat demo is enabled; any failure reads as disabled. */
export async function GET(): Promise<Response> {
  try {
    const upstream = await apiFetch("/v1/chat/status", { signal: AbortSignal.timeout(5000) });
    if (!upstream.ok) return reply(DISABLED);
    const body: unknown = await upstream.json();
    const enabled =
      !!body && typeof body === "object" && "enabled" in body && body.enabled === true;
    return reply({ enabled });
  } catch {
    return reply(DISABLED);
  }
}
