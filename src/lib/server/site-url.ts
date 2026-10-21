/**
 * The public origin from the runtime `SITE_URL`, or null when it is unset or not an absolute
 * http(s) URL (e.g. the `CHANGE_ME` of `.env.example`). Callers fall back to something safe
 * (the request's own origin, or a warning on /admin); an invalid value is never used.
 */
export function configuredSiteOrigin(value: string | undefined = process.env.SITE_URL): string | null {
  const configured = value?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}
