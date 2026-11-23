import Link from "next/link";
import { useTranslations } from "next-intl";
import { placeholderQualifier } from "@/content/replays";
import type { Locale, Project } from "@/content/types";
import {
  DEMO_CHIP_STYLE,
  ProjectCard,
  SOON_CHIP_STYLE,
  chipClass,
  placeholderChipClass,
  staticDemoLabelKey,
} from "./ProjectCard";

const eyebrowClass = "font-mono text-label-mono-sm uppercase text-secondary";
const sectionTitleClass = "text-headline-lg-mobile text-on-surface md:text-headline-lg";
const containerClass = "mx-auto w-full max-w-[1200px] px-margin md:px-margin-tablet lg:px-margin-desktop";

/** Featured projects (by `order`) go first and large; every other project is listed after them. */
export function splitHomeProjects(projects: Project[]): { featured: Project[]; others: Project[] } {
  const sorted = [...projects].sort((a, b) => a.order - b.order);
  return {
    featured: sorted.filter((p) => p.featured),
    others: sorted.filter((p) => !p.featured),
  };
}

function FeaturedCard({ project, locale }: { project: Project; locale: Locale }) {
  const t = useTranslations();
  // Same rules as ProjectCard: a live demo is "live · invite only", and its replay
  // fallback's placeholder status is qualified inside the demo, not here.
  const placeholder = project.demoKind !== "live" ? placeholderQualifier(project) : undefined;
  return (
    <article className="grid overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4 p-6 md:p-8">
        <p className="flex flex-wrap gap-2">
          <span className={`${chipClass} border-outline-variant text-on-surface`}>{t(`groups.${project.group}`)}</span>
          {project.demoKind !== "none" ? (
            <span className={`${chipClass} ${DEMO_CHIP_STYLE[project.demoKind]}`}>
              {t(`demo.badge.${staticDemoLabelKey(project.demoKind)}.label`)}
            </span>
          ) : project.demoSoon ? (
            <span className={`${chipClass} ${SOON_CHIP_STYLE}`}>{t("demo.soon.label")}</span>
          ) : null}
          {placeholder ? (
            <span className={placeholderChipClass}>{t(`demo.badgeQualifier.${placeholder}.chip`)}</span>
          ) : null}
        </p>
        <h3 className="text-headline-lg-mobile text-on-surface md:text-headline-lg">{project.title[locale]}</h3>
        <p className="text-body-lg text-on-surface-variant">{project.tagline[locale]}</p>
        <ul className="flex flex-col gap-2">
          {project.highlights[locale].slice(0, 3).map((item) => (
            <li key={item} className="flex gap-2 text-body-md text-on-surface-variant">
              <span aria-hidden="true" className="text-secondary">
                ▹
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap gap-1.5">
          {project.tech.map((item) => (
            <li key={item} className={`${chipClass} border-outline-variant bg-surface-container text-on-surface-variant`}>
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-3">
          {project.demoKind !== "none" ? (
            <Link
              href={`/${locale}/projects/${project.slug}#demo`}
              className="rounded-lg bg-primary px-4 py-2.5 text-body-md font-semibold text-on-primary transition-colors hover:bg-primary-fixed"
            >
              {t("home.featured.cta")}
            </Link>
          ) : project.demoSoon && project.website ? (
            <a
              href={project.website}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-primary px-4 py-2.5 text-body-md font-semibold text-on-primary transition-colors hover:bg-primary-fixed"
            >
              {t("detail.visitSite")} <span aria-hidden="true">↗</span>
            </a>
          ) : null}
          <Link
            href={`/${locale}/projects/${project.slug}`}
            className="rounded-lg border border-outline-variant px-4 py-2.5 text-body-md font-semibold text-on-surface transition-colors hover:border-outline"
          >
            {t("home.featured.readMore")}
          </Link>
        </div>
      </div>
      <div className="relative min-h-56 border-t border-outline-variant bg-surface-container-lowest lg:border-t-0 lg:border-l">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={project.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
      </div>
    </article>
  );
}

/** Home page project sections, driven entirely by the given project list. */
export function HomeProjectSections({ projects, locale }: { projects: Project[]; locale: Locale }) {
  const t = useTranslations();
  const { featured, others } = splitHomeProjects(projects);
  return (
    <>
      {featured.length > 0 ? (
        <section aria-labelledby="featured-heading" className={containerClass}>
          <div className="mb-6 flex flex-col gap-2">
            <p className={eyebrowClass}>{t("home.featured.eyebrow")}</p>
            <h2 id="featured-heading" className={sectionTitleClass}>
              {t("home.featured.title")}
            </h2>
          </div>
          <div className="flex flex-col gap-6">
            {featured.map((project) => (
              <FeaturedCard key={project.slug} project={project} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}

      {others.length > 0 ? (
        <section aria-labelledby="others-heading" className={containerClass}>
          <div className="mb-6 flex flex-col gap-2">
            <p className={eyebrowClass}>{t("home.others.eyebrow")}</p>
            <h2 id="others-heading" className={sectionTitleClass}>
              {t("home.others.title")}
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {others.map((project) => (
              <ProjectCard key={project.slug} project={project} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
