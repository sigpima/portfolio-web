import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

// Localized 404 for /{locale}/... (unknown project slug or any unknown path).
export default function LocaleNotFound() {
  const t = useTranslations("notFound");
  const locale = useLocale();
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-start justify-center gap-4 px-margin py-16">
      <p className="font-mono text-label-mono-sm text-secondary">404</p>
      <h1 className="text-headline-lg text-on-surface">{t("title")}</h1>
      <p className="text-body-lg text-on-surface-variant">{t("body")}</p>
      <p className="flex flex-wrap gap-3">
        <Link
          href={`/${locale}`}
          className="rounded-lg bg-primary px-4 py-2 text-body-md font-semibold text-on-primary hover:bg-primary-fixed"
        >
          {t("home")}
        </Link>
        <Link
          href={`/${locale}/projects`}
          className="rounded-lg border border-outline-variant px-4 py-2 text-body-md font-semibold text-on-surface hover:border-outline"
        >
          {t("projects")}
        </Link>
      </p>
    </div>
  );
}
