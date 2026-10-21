import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HomeProjectSections, splitHomeProjects } from "@/components/HomeProjects";
import OrbitAvatar, { type OrbitLink } from "@/components/OrbitAvatar";
import { chipClass, DEMO_CHIP_STYLE } from "@/components/ProjectCard";
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
  const featured = splitHomeProjects(projects).featured[0];
  const tech = Array.from(new Set(projects.flatMap((p) => p.tech)));

  const contacts: { key: string; label: string; value: string | null; href: string | null }[] = [
    { key: "email", label: t("home.contact.email"), value: site.email, href: `mailto:${site.email}` },
    { key: "github", label: t("home.contact.github"), value: site.github, href: site.github },
    { key: "linkedin", label: t("home.contact.linkedin"), value: site.linkedin, href: site.linkedin },
    { key: "cv", label: t("home.contact.cv"), value: site.cv, href: site.cv },
  ];

  // The planets around the avatar: only real values (a TODO placeholder never becomes a link).
  const orbitCandidates: OrbitLink[] = [
    { key: "github", label: t("home.contact.github"), href: site.github, icon: "github" },
    { key: "linkedin", label: t("home.contact.linkedin"), href: site.linkedin, icon: "linkedin" },
    { key: "email", label: t("home.contact.email"), href: `mailto:${site.email}`, icon: "mail" },
  ];
  const orbitLinks = orbitCandidates.filter((link) => !isPending(link.href.replace(/^mailto:/, "")));

  return (
    <div className="flex flex-col gap-20 pb-10 md:gap-24">
      {/* Hero */}
      <section aria-labelledby="hero-heading" className={`${containerClass} pt-12 md:pt-20`}>
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <p className="text-headline-lg-mobile font-bold text-on-surface md:text-headline-lg">
                {site.name[locale]}
              </p>
              <p className="w-fit rounded-full border border-secondary/50 bg-secondary/10 px-4 py-1.5 font-mono text-body-lg font-semibold uppercase tracking-wider text-secondary">
                {site.title[locale]}
              </p>
            </div>
            <h1 id="hero-heading" className="text-display-xl-mobile text-on-surface md:text-display-xl">
              {t("home.hero.headline")}
            </h1>
            <div className="flex flex-wrap gap-3">
              {featured && featured.demoKind !== "none" ? (
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
          <div className="flex flex-col gap-8">
            <OrbitAvatar
              name={site.name[locale]}
              avatarSrc={site.avatar}
              label={t("home.orbit.label")}
              links={orbitLinks}
            />
            <div className="flex flex-col gap-3 border-l-2 border-primary-container/60 pl-5">
              <p className="text-body-lg text-on-surface-variant">{t("home.hero.lead")}</p>
              <p className="text-body-md text-outline">{site.bio[locale]}</p>
            </div>
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

      <HomeProjectSections projects={projects} locale={locale} />

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
