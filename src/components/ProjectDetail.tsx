import Link from "next/link";
import { useTranslations } from "next-intl";
import { demoComponents } from "@/components/demos/registry";
import { DemoBadge, PageBadgeProvider } from "@/components/demos/DemoBadge";
import { LiveAwareBadge } from "@/components/demos/LiveAwareBadge";
import type { Locale, Project } from "@/content/types";
import { isPlaceholderDemo } from "@/content/replays";
import { chipClass, placeholderChipClass, staticDemoLabelKey } from "./ProjectCard";

const eyebrowClass = "font-mono text-label-mono-sm uppercase text-secondary";

function NarrativeSection({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <p aria-hidden="true" className={eyebrowClass}>
        {index}
      </p>
      <h2 className="text-headline-lg-mobile text-on-surface md:text-headline-lg">{title}</h2>
      {children}
    </section>
  );
}

/** Case-study page body: narrative, facts, and (when there is one) the labelled demo. */
export function ProjectDetail({ project, locale }: { project: Project; locale: Locale }) {
  const t = useTranslations();
  const hasDemo = project.demoKind !== "none" && project.demo !== undefined;
  const Demo = hasDemo ? demoComponents[project.demo!.component] : undefined;
  const demoKind = project.demoKind === "none" ? null : project.demoKind;
  // Derived from the replay data: every sample is a placeholder. For a live demo this
  // is its replay fallback, which only the in-demo badge talks about.
  const qualifier = isPlaceholderDemo(project) ? ("placeholder" as const) : undefined;
  const qualifierChip = qualifier && demoKind !== "live" ? t("demo.badgeQualifier.placeholder.chip") : null;
  // Static labels never say "live" on its own: a live demo is live only with an invite.
  const staticLabel = demoKind ? t(`demo.badge.${staticDemoLabelKey(demoKind)}.label`) : null;

  return (
    <article className="mx-auto flex max-w-[1200px] flex-col gap-12 px-margin py-10 md:px-margin-tablet md:py-14 lg:px-margin-desktop">
      <header className="flex flex-col gap-5">
        <Link
          href={`/${locale}/projects`}
          className="w-fit rounded font-mono text-label-mono-sm uppercase text-on-surface-variant hover:text-on-surface"
        >
          <span aria-hidden="true">← </span>
          {t("detail.back")}
        </Link>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={eyebrowClass}>
            {t(`groups.${project.group}`)}
            {staticLabel ? ` · ${staticLabel}` : null}
          </span>
          {qualifierChip ? <span className={placeholderChipClass}>{qualifierChip}</span> : null}
        </p>
        <h1 className="max-w-4xl text-display-xl-mobile text-on-surface md:text-display-xl">
          {project.title[locale]}
        </h1>
        <p className="max-w-3xl text-headline-md font-normal text-on-surface">{project.tagline[locale]}</p>
        <p className="max-w-3xl text-body-lg text-on-surface-variant">{project.summary[locale]}</p>
        {Demo ? (
          <a
            href="#demo"
            className="w-fit rounded-lg bg-primary px-4 py-2 font-mono text-label-mono-sm uppercase text-on-primary transition-colors hover:bg-primary-fixed"
          >
            {t("detail.toDemo")} <span aria-hidden="true">↓</span>
          </a>
        ) : null}
      </header>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <dt className="font-mono text-label-mono-xs uppercase text-outline">{t("detail.facts.group")}</dt>
          <dd className="text-headline-md text-on-surface">{t(`groups.${project.group}`)}</dd>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <dt className="font-mono text-label-mono-xs uppercase text-outline">{t("detail.facts.demo")}</dt>
          <dd className="flex flex-col items-start gap-1.5 text-headline-md text-on-surface">
            <span>{staticLabel ?? t("card.noDemo")}</span>
            {qualifierChip ? <span className={placeholderChipClass}>{qualifierChip}</span> : null}
          </dd>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <dt className="font-mono text-label-mono-xs uppercase text-outline">{t("detail.facts.stack")}</dt>
          <dd className="text-headline-md text-on-surface">{project.tech.slice(0, 3).join(" · ")}</dd>
        </div>
      </dl>

      {Demo && demoKind ? (
        <section
          id="demo"
          aria-labelledby="demo-heading"
          className="flex scroll-mt-20 flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4 md:p-6"
        >
          <h2 id="demo-heading" className="font-mono text-label-mono-sm uppercase text-outline">
            {t("detail.demoTitle")}
          </h2>
          {demoKind === "live" ? (
            // Depends on the visitor's invite: a client component decides after /api/session.
            <LiveAwareBadge locale={locale} replayQualifier={qualifier} />
          ) : (
            <DemoBadge kind={demoKind} locale={locale} qualifier={qualifier} />
          )}
          <PageBadgeProvider qualifier={qualifier}>
            <Demo locale={locale} />
          </PageBadgeProvider>
        </section>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-10">
          <NarrativeSection index="01" title={t("detail.problem")}>
            <p className="text-body-lg text-on-surface-variant">{project.problem[locale]}</p>
          </NarrativeSection>
          <NarrativeSection index="02" title={t("detail.approach")}>
            <p className="text-body-lg text-on-surface-variant">{project.approach[locale]}</p>
          </NarrativeSection>
          <NarrativeSection index="03" title={t("detail.highlights")}>
            <ul className="flex flex-col gap-3">
              {project.highlights[locale].map((item) => (
                <li
                  key={item}
                  className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-body-md text-on-surface"
                >
                  {item}
                </li>
              ))}
            </ul>
          </NarrativeSection>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
          <section className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-5">
            <h2 className="font-mono text-label-mono-sm uppercase text-outline">{t("detail.tech")}</h2>
            <ul className="flex flex-wrap gap-1.5">
              {project.tech.map((tech) => (
                <li key={tech} className={`${chipClass} border-outline-variant bg-surface-container text-on-surface`}>
                  {tech}
                </li>
              ))}
            </ul>
          </section>
          <section className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-5">
            <h2 className="font-mono text-label-mono-sm uppercase text-outline">{t("detail.links")}</h2>
            {project.links.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {project.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-body-md text-primary underline underline-offset-4 hover:text-primary-fixed"
                    >
                      {link.label[locale]}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-md text-on-surface-variant">{t("detail.noLinks")}</p>
            )}
          </section>
        </aside>
      </div>
    </article>
  );
}
