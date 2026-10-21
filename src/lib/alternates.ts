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

/** Base URL for absolute metadata URLs; set SITE_URL in production. */
export const metadataBase = new URL(process.env.SITE_URL ?? "http://localhost:3000");
