import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProjectDetail } from "@/components/ProjectDetail";
import { getProject, listProjects } from "@/content/registry";
import type { Locale } from "@/content/types";
import { routing } from "@/i18n/routing";
import { languageAlternates } from "@/lib/alternates";

// Only the registry's slugs exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    listProjects().map((project) => ({ locale, slug: project.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const project = getProject(slug);
  if (!hasLocale(routing.locales, locale) || !project) return {};
  return {
    title: project.title[locale],
    description: project.tagline[locale],
    alternates: languageAlternates(`/projects/${slug}`, locale),
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  // The layout's notFound() does not stop this page from rendering in parallel.
  if (!hasLocale(routing.locales, raw)) notFound();
  const locale: Locale = raw;
  setRequestLocale(locale);
  const project = getProject(slug);
  if (!project) notFound();

  const t = await getTranslations({ locale, namespace: "detail" });
  const all = listProjects();
  const index = all.findIndex((p) => p.slug === project.slug);
  const prev = index > 0 ? all[index - 1] : undefined;
  const next = index < all.length - 1 ? all[index + 1] : undefined;

  return (
    <>
      <ProjectDetail project={project} locale={locale} />
      <nav
        aria-label={t("pagerLabel")}
        className="mx-auto w-full max-w-[1200px] px-margin md:px-margin-tablet lg:px-margin-desktop"
      >
        <ul className="grid gap-3 border-t border-outline-variant pt-8 sm:grid-cols-2">
          <li>
            {prev ? (
              <Link
                href={`/${locale}/projects/${prev.slug}`}
                className="flex flex-col gap-1 rounded-xl border border-outline-variant bg-surface-container-low p-4 hover:border-outline"
              >
                <span className="font-mono text-label-mono-xs uppercase text-outline">← {t("prev")}</span>
                <span className="text-body-lg font-semibold text-on-surface">{prev.title[locale]}</span>
              </Link>
            ) : null}
          </li>
          <li>
            {next ? (
              <Link
                href={`/${locale}/projects/${next.slug}`}
                className="flex flex-col items-end gap-1 rounded-xl border border-outline-variant bg-surface-container-low p-4 text-right hover:border-outline"
              >
                <span className="font-mono text-label-mono-xs uppercase text-outline">{t("next")} →</span>
                <span className="text-body-lg font-semibold text-on-surface">{next.title[locale]}</span>
              </Link>
            ) : null}
          </li>
        </ul>
      </nav>
    </>
  );
}
