"use client";

import { Suspense } from "react";
import NextLink from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/content/types";

const OTHER_LOCALE: Record<Locale, Locale> = { vi: "en", en: "vi" };

const switchClass =
  "shrink-0 rounded border border-outline-variant px-2.5 py-1.5 font-mono text-label-mono-sm text-on-surface-variant transition-colors hover:border-outline hover:bg-surface-container hover:text-on-surface sm:px-3";

type SwitchProps = { other: Locale; label: string; pathname: string };

/** Language switch that keeps the current path and query string. */
function LocaleSwitchWithQuery({ other, label, pathname }: SwitchProps) {
  const searchParams = useSearchParams();
  const query = Object.fromEntries(searchParams?.entries() ?? []);
  return (
    <Link href={{ pathname, query }} locale={other} lang={other} className={switchClass}>
      {label}
    </Link>
  );
}

function LocaleSwitch(props: SwitchProps) {
  // useSearchParams needs a Suspense boundary on statically rendered pages;
  // the fallback (path only) is what the server HTML contains.
  const fallback = (
    <Link href={props.pathname} locale={props.other} lang={props.other} className={switchClass}>
      {props.label}
    </Link>
  );
  return (
    <Suspense fallback={fallback}>
      <LocaleSwitchWithQuery {...props} />
    </Suspense>
  );
}

export default function SiteHeader({ locale }: { locale: Locale }) {
  const t = useTranslations("header");
  // Path without the locale prefix, e.g. "/" or "/projects/knowledge-base".
  const pathname = usePathname() ?? "/";
  const other = OTHER_LOCALE[locale];

  const homeHref = `/${locale}`;
  const projectsHref = `/${locale}/projects`;
  const isHome = pathname === "/";
  const isProjects = pathname === "/projects" || pathname.startsWith("/projects/");

  const linkClass =
    "block rounded px-2 py-1.5 text-body-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface aria-[current=page]:text-on-surface aria-[current=page]:bg-surface-container-high sm:px-3";

  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant/60 bg-surface-container-lowest/85 backdrop-blur-md">
      <div className="mx-auto flex min-h-14 max-w-[1200px] flex-wrap items-center justify-between gap-x-3 gap-y-1 px-margin py-2 md:px-margin-tablet lg:px-margin-desktop">
        <NextLink
          href={homeHref}
          className="min-w-0 font-mono text-label-mono-sm uppercase text-primary"
        >
          {t("brand")}
        </NextLink>

        <div className="flex items-center gap-1 sm:gap-4">
          <nav aria-label={t("navLabel")}>
            <ul className="flex items-center gap-0.5 sm:gap-1">
              <li>
                <NextLink
                  href={homeHref}
                  className={linkClass}
                  aria-current={isHome ? "page" : undefined}
                >
                  {t("home")}
                </NextLink>
              </li>
              <li>
                <NextLink
                  href={projectsHref}
                  className={linkClass}
                  aria-current={isProjects ? "page" : undefined}
                >
                  {t("projects")}
                </NextLink>
              </li>
            </ul>
          </nav>

          <LocaleSwitch
            other={other}
            label={t(other === "vi" ? "switchToVi" : "switchToEn")}
            pathname={pathname}
          />
        </div>
      </div>
    </header>
  );
}
