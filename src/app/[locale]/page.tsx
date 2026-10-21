import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProjectCard, chipClass, DEMO_CHIP_STYLE } from "@/components/ProjectCard";
import { listProjects } from "@/content/registry";
import { site } from "@/content/site";
import type { DemoKind, Locale } from "@/content/types";
import { routing } from "@/i18n/routing";
import { languageAlternates } from "@/lib/alternates";

const BADGE_KINDS: Exclude<DemoKind, "none">[] = ["live", "replay", "simulation"];

const eyebrowClass = "font-mono text-label-mono-sm uppercase text-secondary";
const sectionTitleClass = "text-headline-lg-mobile text-on-surface md:text-headline-lg";
const containerClass = "mx-auto w-full max-w-[1200px] px-margin md:px-margin-tablet lg:px-margin-desktop";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: { absolute: t("title") },
    description: t("description"),
    alternates: languageAlternates("", locale),
  };
}

/** A contact value that is still a "TODO:" placeholder is shown as text, not a link. */
function isPending(value: string | null): boolean {
  return value === null || value.trim() === "" || value.startsWith("TODO");
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  // The layout's notFound() does not stop this page from rendering in parallel.
  if (!hasLocale(routing.locales, raw)) notFound();
  const locale: Locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });

  const projects = listProjects();
  const featured = projects.find((p) => p.slug === "knowledge-base") ?? projects.find((p) => p.featured);
  const websites = projects.filter((p) => p.group === "website");
  const tech = Array.from(new Set(projects.flatMap((p) => p.tech)));

  const contacts: { key: string; label: string; value: string | null; href: string | null }[] = [
    { key: "email", label: t("home.contact.email"), value: site.email, href: `mailto:${site.email}` },
    { key: "github", label: t("home.contact.github"), value: site.github, href: site.github },
    { key: "cv", label: t("home.contact.cv"), value: site.cv, href: site.cv },
  ];

  return (
    <div className="flex flex-col gap-20 pb-10 md:gap-24">
      {/* Hero */}
      <section aria-labelledby="hero-heading" className={`${containerClass} pt-12 md:pt-20`}>
        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-12">
          <div className="flex flex-col gap-6">
            <p className="w-fit rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 font-mono text-label-mono-sm uppercase text-secondary">
              {site.title[locale]}
            </p>
            <p className="font-mono text-label-mono-sm uppercase text-on-surface-variant">{site.name}</p>
            <h1 id="hero-heading" className="text-display-xl-mobile text-on-surface md:text-display-xl">
              {t("home.hero.headline")}
            </h1>
            <div className="flex flex-wrap gap-3">
              {featured ? (
                <Link
                  href={`/${locale}/projects/${featured.slug}#demo`}
                  className="rounded-lg bg-primary px-4 py-2.5 text-body-md font-semibold text-on-primary transition-colors hover:bg-primary-fixed"
                >
                  {t("home.hero.ctaDemo")}
                </Link>
              ) : null}
              <Link
                href={`/${locale}/projects`}
                className="rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-body-md font-semibold text-on-surface transition-colors hover:border-outline"
              >
                {t("home.hero.ctaProjects")} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <div className="flex flex-col gap-3 border-l-2 border-primary-container/60 pl-5">
            <p className="text-body-lg text-on-surface-variant">{t("home.hero.lead")}</p>
            <p className="text-body-md text-outline">{site.bio[locale]}</p>
          </div>
        </div>

        {/* Demo labels strip (in place of the mockup's stats, which we do not have) */}
        <div className="mt-12 flex flex-col gap-4">
          <h2 className="font-mono text-label-mono-sm uppercase text-on-surface-variant">
            {t("home.labels.title")}
          </h2>
          <ul className="grid gap-3 md:grid-cols-3">
            {BADGE_KINDS.map((kind) => (
              <li
                key={kind}
                className="flex flex-col gap-2 rounded-xl border border-outline-variant bg-surface-container-low p-5"
              >
                <span className={`${chipClass} w-fit ${DEMO_CHIP_STYLE[kind]}`}>
                  {t(`demo.badge.${kind}.label`)}
                </span>
                <p className="text-body-md text-on-surface-variant">{t(`demo.badge.${kind}.description`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Featured: Knowledge Base */}
      {featured ? (
        <section aria-labelledby="featured-heading" className={containerClass}>
          <div className="mb-6 flex flex-col gap-2">
            <p className={eyebrowClass}>{t("home.featured.eyebrow")}</p>
            <h2 id="featured-heading" className={sectionTitleClass}>
              {t("home.featured.title")}
            </h2>
          </div>
          <article className="grid overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-4 p-6 md:p-8">
              <p className="flex flex-wrap gap-2">
                <span className={`${chipClass} border-outline-variant text-on-surface`}>
                  {t(`groups.${featured.group}`)}
                </span>
                {featured.demoKind !== "none" ? (
                  <span className={`${chipClass} ${DEMO_CHIP_STYLE[featured.demoKind]}`}>
                    {t(`demo.badge.${featured.demoKind}.label`)}
                  </span>
                ) : null}
              </p>
              <h3 className="text-headline-lg-mobile text-on-surface md:text-headline-lg">
                {featured.title[locale]}
              </h3>
              <p className="text-body-lg text-on-surface-variant">{featured.tagline[locale]}</p>
              <ul className="flex flex-col gap-2">
                {featured.highlights[locale].slice(0, 3).map((item) => (
                  <li key={item} className="flex gap-2 text-body-md text-on-surface-variant">
                    <span aria-hidden="true" className="text-secondary">
                      ▹
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <ul className="flex flex-wrap gap-1.5">
                {featured.tech.map((item) => (
                  <li key={item} className={`${chipClass} border-outline-variant bg-surface-container text-on-surface-variant`}>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-3">
                <Link
                  href={`/${locale}/projects/${featured.slug}#demo`}
                  className="rounded-lg bg-primary px-4 py-2.5 text-body-md font-semibold text-on-primary transition-colors hover:bg-primary-fixed"
                >
                  {t("home.featured.cta")}
                </Link>
                <Link
                  href={`/${locale}/projects/${featured.slug}`}
                  className="rounded-lg border border-outline-variant px-4 py-2.5 text-body-md font-semibold text-on-surface transition-colors hover:border-outline"
                >
                  {t("home.featured.readMore")}
                </Link>
              </div>
            </div>
            <div className="relative min-h-56 border-t border-outline-variant bg-surface-container-lowest lg:border-t-0 lg:border-l">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={featured.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
            </div>
          </article>
        </section>
      ) : null}

      {/* Websites */}
      <section aria-labelledby="websites-heading" className={containerClass}>
        <div className="mb-6 flex flex-col gap-2">
          <p className={eyebrowClass}>{t("home.websites.eyebrow")}</p>
          <h2 id="websites-heading" className={sectionTitleClass}>
            {t("home.websites.title")}
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {websites.map((project) => (
            <ProjectCard key={project.slug} project={project} locale={locale} />
          ))}
        </div>
      </section>

      {/* Tech strip */}
      <section aria-labelledby="stack-heading" className={containerClass}>
        <div className="mb-6 flex flex-col gap-2">
          <p className={eyebrowClass}>{t("home.stack.eyebrow")}</p>
          <h2 id="stack-heading" className={sectionTitleClass}>
            {t("home.stack.title")}
          </h2>
          <p className="text-body-md text-on-surface-variant">{t("home.stack.lead")}</p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {tech.map((item) => (
            <li
              key={item}
              className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-1.5 font-mono text-code-inline text-on-surface"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Contact */}
      <section aria-labelledby="contact-heading" className={containerClass}>
        <div className="flex flex-col gap-6 rounded-xl border border-outline-variant bg-surface-container-low p-6 md:flex-row md:items-center md:justify-between md:p-10">
          <div className="flex flex-col gap-2">
            <p className={eyebrowClass}>{t("home.contact.eyebrow")}</p>
            <h2 id="contact-heading" className={sectionTitleClass}>
              {t("home.contact.title")}
            </h2>
            <p className="text-body-lg text-on-surface-variant">{t("home.contact.lead")}</p>
          </div>
          <ul className="flex min-w-0 flex-col gap-2">
            {contacts.map((c) => (
              <li key={c.key} className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="w-16 font-mono text-label-mono-sm uppercase text-outline">{c.label}</span>
                {isPending(c.value) || !c.href ? (
                  <span className="min-w-0 break-words text-body-md text-on-surface-variant">
                    {c.value ?? t("home.contact.pending")}
                  </span>
                ) : (
                  <a
                    href={c.href}
                    className="min-w-0 break-all text-body-md text-primary underline underline-offset-4 hover:text-primary-fixed"
                  >
                    {c.value}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
