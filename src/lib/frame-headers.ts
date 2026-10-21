/**
 * Anti-framing headers for the admin surface (`/admin` and `/api/admin/*`), used by the
 * `headers()` of next.config.ts: no other site may embed it in a frame (clickjacking).
 */
const NO_FRAMING = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

export const adminFrameHeaders = [
  { source: "/admin", headers: NO_FRAMING },
  { source: "/admin/:path*", headers: NO_FRAMING },
  { source: "/api/admin/:path*", headers: NO_FRAMING },
];
