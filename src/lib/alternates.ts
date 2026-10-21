import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

/** hreflang alternates for a locale-independent path such as "" or "/projects". */
export function languageAlternates(path: string, locale: string): Metadata["alternates"] {
  return {
    canonical: `/${locale}${path}`,
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, `/${l}${path}`])),
      "x-default": `/${routing.defaultLocale}${path}`,
    },
  };
}

const DEV_SITE_URL = "http://localhost:3000";

interface SiteUrlEnv {
  SITE_URL?: string;
  NODE_ENV?: string;
  REQUIRE_SITE_URL?: string;
}

/**
 * Resolves the public site URL used for absolute metadata (canonical, hreflang, Open Graph).
 * Pages are statically generated, so this runs at BUILD time: SITE_URL must be set when
 * building the production image. Without it in production we warn loudly (and fail only when
 * REQUIRE_SITE_URL=1) instead of silently baking http://localhost:3000 into every page.
 */
export function resolveSiteUrl(
  env: SiteUrlEnv = process.env,
  warn: (message: string) => void = console.warn,
): URL {
  const configured = env.SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured);
    } catch {
      throw new Error(`SITE_URL is not a valid absolute URL: "${configured}" (example: https://example.com)`);
    }
  }
  if (env.NODE_ENV === "production") {
    const message =
      `SITE_URL is not set: canonical and hreflang URLs will point at ${DEV_SITE_URL}. ` +
      "Set SITE_URL (for example https://example.com) when building for production.";
    if (env.REQUIRE_SITE_URL === "1") throw new Error(message);
    warn(`[portfolio-web] WARNING: ${message}`);
  }
  return new URL(DEV_SITE_URL);
}

/** Base URL for absolute metadata URLs; set SITE_URL in production (see resolveSiteUrl). */
export const metadataBase = resolveSiteUrl();
