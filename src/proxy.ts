import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next 16 renamed the `middleware` file convention to `proxy`.
// Detects the browser language (Accept-Language) and redirects `/` to `/{locale}`.
export default createMiddleware(routing);

export const config = {
  // Only the root and already-prefixed paths. Anything else (e.g. `/fr`) is
  // not rewritten to `/en/fr`, so an unknown locale is a plain 404.
  matcher: ["/", "/(vi|en)/:path*"],
};
