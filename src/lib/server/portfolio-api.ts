import { createHmac } from "node:crypto";
import { isIPv4, isIPv6 } from "node:net";

/**
 * Server-side bridge to the internal `portfolio-api` service. The browser never talks to it:
 * only these helpers do, with the shared `X-Internal-Key`.
 */

const DEFAULT_URL = "http://portfolio-api:8100";
const DEFAULT_TIMEOUT_MS = 10_000;
// Headers only this module may set; never copied from a caller (and so never from a browser).
const RESERVED = ["x-internal-key", "x-session", "x-admin-session", "x-client-key", "cookie", "authorization"];

/** Base URL of `portfolio-api` (no trailing slash). */
export function portfolioApiUrl(): string {
  return (process.env.PORTFOLIO_API_URL || DEFAULT_URL).replace(/\/+$/, "");
}

function internalKey(): string {
  const key = process.env.PORTFOLIO_API_KEY?.trim();
  if (!key) throw new Error("PORTFOLIO_API_KEY is not set: cannot call portfolio-api");
  return key;
}

export type ApiFetchInit = RequestInit & {
  session?: string;
  adminSession?: string;
  clientKey?: string;
};

/**
 * `fetch` against `portfolio-api`. Adds `X-Internal-Key` plus the explicit `session`,
 * `adminSession` and `clientKey` options (empty ones are omitted); caller headers named like
 * those are dropped. No caching; a 10 s timeout unless the caller passes its own `signal`.
 * Throws when `PORTFOLIO_API_KEY` is missing.
 */
export async function apiFetch(path: string, init: ApiFetchInit = {}): Promise<Response> {
  const { session, adminSession, clientKey, headers: callerHeaders, signal, ...rest } = init;
  const key = internalKey();
  const headers = new Headers(callerHeaders);
  for (const name of RESERVED) headers.delete(name);
  headers.set("X-Internal-Key", key);
  if (session) headers.set("X-Session", session);
  if (adminSession) headers.set("X-Admin-Session", adminSession);
  if (clientKey) headers.set("X-Client-Key", clientKey);
  return fetch(`${portfolioApiUrl()}${path}`, {
    ...rest,
    headers,
    cache: "no-store",
    signal: signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
}

const UNKNOWN_CLIENT = "unknown";
let warnedMissingRealIp = false;

/** Expands an IPv6 address into 8 numeric hextets, or null when it cannot be parsed. */
function ipv6Hextets(address: string): number[] | null {
  let text = address;
  // Embedded dotted IPv4 tail (e.g. ::ffff:1.2.3.4) -> two hextets.
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    if (!isIPv4(tail)) return null;
    const [a, b, c, d] = tail.split(".").map(Number);
    text = `${text.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string) => (part ? part.split(":").map((h) => parseInt(h, 16)) : []);
  const head = parse(halves[0]);
  const back = halves.length === 2 ? parse(halves[1]) : [];
  const fill = 8 - head.length - back.length;
  if (halves.length === 2 ? fill < 0 : fill !== 0) return null;
  const all = [...head, ...Array<number>(Math.max(fill, 0)).fill(0), ...back];
  return all.length === 8 && all.every((h) => Number.isInteger(h) && h >= 0 && h <= 0xffff) ? all : null;
}

/**
 * Normalises an address before hashing: IPv4 as is, IPv4-mapped IPv6 as its IPv4,
 * other IPv6 reduced to its /64 prefix (one end site = one bucket).
 */
function normalizeAddress(raw: string): string {
  let address = raw.trim().toLowerCase();
  if (address.startsWith("[") && address.endsWith("]")) address = address.slice(1, -1);
  const zone = address.indexOf("%");
  if (zone !== -1) address = address.slice(0, zone);
  if (!isIPv6(address)) return address;
  const h = ipv6Hextets(address);
  if (!h) return address;
  if (h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff) {
    return [h[6] >> 8, h[6] & 0xff, h[7] >> 8, h[7] & 0xff].join(".");
  }
  return `${h.slice(0, 4).map((x) => x.toString(16)).join(":")}::/64`;
}

function clientAddress(request: Request): string | null {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  // nginx appends the real peer to the END; earlier entries are whatever the client sent.
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return forwarded?.length ? forwarded[forwarded.length - 1] : null;
}

/**
 * Rate-limit key for `X-Client-Key`: HMAC-SHA256 (keyed with PORTFOLIO_API_KEY) of the
 * normalised client address, as hex. The raw address never leaves this function. Without any
 * address header returns the shared literal "unknown" (warned once in production).
 */
export function clientKeyFrom(request: Request): string {
  const address = clientAddress(request);
  if (!address) {
    if (process.env.NODE_ENV === "production" && !warnedMissingRealIp) {
      warnedMissingRealIp = true;
      console.error(
        "[portfolio-web] X-Real-IP header is missing: the reverse proxy must set it, " +
          "otherwise all visitors share one rate-limit bucket.",
      );
    }
    return UNKNOWN_CLIENT;
  }
  return createHmac("sha256", internalKey()).update(normalizeAddress(address)).digest("hex");
}
