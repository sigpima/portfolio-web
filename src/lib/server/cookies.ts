/** Visitor session cookie (value issued by portfolio-api on `POST /v1/invites/open`). */
export const SESSION_COOKIE = "pf_session";
/** Admin session cookie. */
export const ADMIN_COOKIE = "pf_admin";

export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  maxAge: number;
}

/** Options for both session cookies: HttpOnly, SameSite=Lax, Path=/, Secure in production. */
export function sessionCookieOptions(maxAgeSeconds: number): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
  };
}
