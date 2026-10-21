/** Shapes returned by `/api/admin/*` (forwarded unchanged from portfolio-api). */

export type LinkStatus = "active" | "unused" | "revoked" | "expired";

export interface AdminLink {
  id: number;
  name: string;
  status: LinkStatus;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  twistfit_max: number | null;
  counts: { chat: number; twistfit: number; gia_pha: number };
}

export interface AdminEvent {
  id: number;
  ts: string;
  feature: string;
  outcome: string;
  detail: Record<string, unknown> | null;
}
