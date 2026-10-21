import Link from "next/link";
import { useTranslations } from "next-intl";
import { placeholderQualifier } from "@/content/replays";
import type { DemoKind, Locale, Project } from "@/content/types";

/** Short demo-kind chip colours (the label text carries the meaning). */
export const DEMO_CHIP_STYLE: Record<Exclude<DemoKind, "none">, string> = {
  live: "border-secondary/70 text-secondary",
  replay: "border-primary/70 text-primary",
  simulation: "border-dashed border-on-surface-variant text-on-surface",
};

/** Chip that qualifies a demo label while all of its samples are placeholders. */
export const placeholderChipClass =
  "inline-flex items-center rounded border border-error bg-error-container px-2 py-0.5 font-mono text-label-mono-sm text-on-error-container";

/**
 * Message key (under `demo.badge`) of a demo's static label (cards, page eyebrow, facts):
 * a live demo is live only with an invite link, so it never says "live" on its own.
 */
export function staticDemoLabelKey(kind: Exclude<DemoKind, "none">): "liveInvite" | Exclude<DemoKind, "none" | "live"> {
  return kind === "live" ? "liveInvite" : kind;
}

export const chipClass =
  "inline-flex items-center rounded border px-2 py-0.5 font-mono text-label-mono-sm";

export function ProjectCard({
  project,
  locale,
  headingLevel = 3,
}: {
  project: Project;
  locale: Locale;
  headingLevel?: 2 | 3;
}) {
  const t = useTranslations();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const href = `/${locale}/projects/${project.slug}`;
  // A live demo's replay fallback is qualified inside the demo, not next to "live · invite only".
  const placeholder = project.demoKind !== "live" ? placeholderQualifier(project) : undefined;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low transition-colors hover:border-outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-secondary">
      <div className="relative aspect-[16/9] overflow-hidden border-b border-outline-variant bg-surface-container-lowest">
        {/* Decorative SVG cover: plain <img> because the image optimizer refuses SVG. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={project.cover}
          alt=""
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <div className="absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
          <span className={`${chipClass} border-outline-variant bg-surface-container-lowest/90 text-on-surface`}>
            {t(`groups.${project.group}`)}
          </span>
          {project.demoKind !== "none" ? (
            <span className="flex flex-wrap justify-end gap-1.5">
              <span className={`${chipClass} bg-surface-container-lowest/90 ${DEMO_CHIP_STYLE[project.demoKind]}`}>
                {t(`demo.badge.${staticDemoLabelKey(project.demoKind)}.label`)}
              </span>
              {placeholder ? (
                <span className={placeholderChipClass}>{t(`demo.badgeQualifier.${placeholder}.chip`)}</span>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <Heading className="text-headline-md text-on-surface">
          <Link
            href={href}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {project.title[locale]}
          </Link>
        </Heading>
        <p className="text-body-md text-on-surface-variant">{project.tagline[locale]}</p>
        <ul className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {project.tech.map((tech) => (
            <li key={tech} className={`${chipClass} border-outline-variant bg-surface-container text-on-surface-variant`}>
              {tech}
            </li>
          ))}
        </ul>
      </div>

      <div
        aria-hidden="true"
        className="flex items-center justify-between border-t border-outline-variant px-5 py-3 font-mono text-label-mono-sm text-primary"
      >
        <span>{t("card.caseStudy")}</span>
        <span className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none">→</span>
      </div>
    </article>
  );
}
