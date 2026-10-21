"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Locale } from "@/content/types";

const OTHER_LOCALE: Record<Locale, Locale> = { vi: "en", en: "vi" };

/** Replace the leading locale segment of the current path, keeping the rest. */
function switchLocalePath(pathname: string, from: Locale, to: Locale): string {
  const prefix = `/${from}`;
  if (pathname === prefix) return `/${to}`;
  if (pathname.startsWith(`${prefix}/`)) return `/${to}${pathname.slice(prefix.length)}`;
  return `/${to}`;
}

export default function SiteHeader({ locale }: { locale: Locale }) {
  const t = useTranslations("header");
  const pathname = usePathname() ?? `/${locale}`;
  const other = OTHER_LOCALE[locale];

  const homeHref = `/${locale}`;
  const projectsHref = `/${locale}/projects`;
  const isHome = pathname === homeHref || pathname === `${homeHref}/`;
  const isProjects = pathname === projectsHref || pathname.startsWith(`${projectsHref}/`);

  const linkClass =
    "rounded px-3 py-1.5 text-body-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface aria-[current=page]:text-on-surface aria-[current=page]:bg-surface-container-high";

  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant/60 bg-surface-container-lowest/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-margin md:px-margin-tablet lg:px-margin-desktop">
        <Link
          href={homeHref}
          className="font-mono text-label-mono-sm uppercase text-primary"
        >
          {t("brand")}
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <nav aria-label={t("navLabel")}>
            <ul className="flex items-center gap-1">
              <li>
                <Link
                  href={homeHref}
                  className={linkClass}
                  aria-current={isHome ? "page" : undefined}
                >
                  {t("home")}
                </Link>
              </li>
              <li>
                <Link
                  href={projectsHref}
                  className={linkClass}
                  aria-current={isProjects ? "page" : undefined}
                >
                  {t("projects")}
                </Link>
              </li>
            </ul>
          </nav>

          <Link
            href={switchLocalePath(pathname, locale, other)}
            hrefLang={other}
            lang={other}
            className="rounded border border-outline-variant px-3 py-1.5 font-mono text-label-mono-sm text-on-surface-variant transition-colors hover:border-outline hover:bg-surface-container hover:text-on-surface"
          >
            {t(other === "vi" ? "switchToVi" : "switchToEn")}
          </Link>
        </div>
      </div>
    </header>
  );
}
