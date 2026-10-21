import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Locale } from "@/content/types";

export default function SiteFooter({ locale }: { locale: Locale }) {
  const t = useTranslations();
  return (
    <footer className="mt-16 border-t border-outline-variant/60 bg-surface-container-lowest/60">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-margin py-6 sm:flex-row sm:items-center sm:justify-between md:px-margin-tablet lg:px-margin-desktop">
        <p className="font-mono text-label-mono-sm text-on-surface-variant">{t("footer.note")}</p>
        <nav aria-label={t("footer.navLabel")}>
          <ul className="flex gap-4 font-mono text-label-mono-sm">
            <li>
              <Link className="text-on-surface-variant hover:text-on-surface" href={`/${locale}`}>
                {t("header.home")}
              </Link>
            </li>
            <li>
              <Link className="text-on-surface-variant hover:text-on-surface" href={`/${locale}/projects`}>
                {t("header.projects")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
