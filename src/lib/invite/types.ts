export interface InviteFeatures {
  chat: boolean;
  twistfit: boolean;
  gia_pha: boolean;
}

export interface InviteSession {
  invited: boolean;
  features: InviteFeatures;
}

export const NOT_INVITED: InviteSession = {
  invited: false,
  features: { chat: false, twistfit: false, gia_pha: false },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Validates a `{invited, features}` payload; returns a clean copy or null. */
export function parseInviteSession(value: unknown): InviteSession | null {
  if (!isRecord(value) || typeof value.invited !== "boolean") return null;
  const f = value.features;
  if (
    !isRecord(f) ||
    typeof f.chat !== "boolean" ||
    typeof f.twistfit !== "boolean" ||
    typeof f.gia_pha !== "boolean"
  ) {
    return null;
  }
  return { invited: value.invited, features: { chat: f.chat, twistfit: f.twistfit, gia_pha: f.gia_pha } };
}
