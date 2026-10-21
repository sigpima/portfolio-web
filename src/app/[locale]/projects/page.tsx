import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GroupFilter } from "@/components/GroupFilter";
import { ProjectCard } from "@/components/ProjectCard";
import { listProjects } from "@/content/registry";
import type { Locale, ProjectGroup } from "@/content/types";
import { routing } from "@/i18n/routing";
import { languageAlternates } from "@/lib/alternates";

const GROUPS: readonly ProjectGroup[] = ["website", "ai-agent"];

function parseGroup(value: string | string[] | undefined): ProjectGroup | null {
  const single = Array.isArray(value) ? value[0] : value;
  return GROUPS.find((g) => g === single) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "projectsPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: languageAlternates("/projects", locale),
  };
}

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale: raw } = await params;
  // The layout's notFound() does not stop this page from rendering in parallel.
  if (!hasLocale(routing.locales, raw)) notFound();
  const locale: Locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "projectsPage" });
  const active = parseGroup((await searchParams).group);
  const projects = listProjects(active ?? undefined);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-margin py-10 md:px-margin-tablet md:py-14 lg:px-margin-desktop">
      <header className="flex max-w-3xl flex-col gap-3">
        <p className="font-mono text-label-mono-sm uppercase text-secondary">{t("eyebrow")}</p>
        <h1 className="text-display-xl-mobile text-on-surface md:text-display-xl">{t("title")}</h1>
        <p className="text-body-lg text-on-surface-variant">{t("lead")}</p>
      </header>

      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
        <GroupFilter locale={locale} active={active} />
      </div>

      {projects.length > 0 ? (
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.slug} className="flex">
              <div className="flex w-full flex-col [&>article]:flex-1">
                <ProjectCard project={project} locale={locale} headingLevel={2} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body-lg text-on-surface-variant">{t("empty")}</p>
      )}
    </div>
  );
}
