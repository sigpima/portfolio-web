import Link from "next/link";
import { useTranslations } from "next-intl";
import { listProjects } from "@/content/registry";
import type { Locale, ProjectGroup } from "@/content/types";

const GROUPS: ProjectGroup[] = ["website", "ai-agent"];

/** Group filter as links: `?group=website|ai-agent`; "All" drops the parameter. */
export function GroupFilter({ locale, active }: { locale: Locale; active: ProjectGroup | null }) {
  const t = useTranslations();
  const base = `/${locale}/projects`;
  const items: { key: string; label: string; href: string; count: number; current: boolean }[] = [
    { key: "all", label: t("filter.all"), href: base, count: listProjects().length, current: active === null },
    ...GROUPS.map((group) => ({
      key: group,
      label: t(`groups.${group}`),
      href: `${base}?group=${group}`,
      count: listProjects(group).length,
      current: active === group,
    })),
  ];

  return (
    <nav aria-label={t("filter.label")}>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              scroll={false}
              className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-4 py-1.5 font-mono text-label-mono-sm text-on-surface-variant transition-colors hover:border-outline hover:text-on-surface aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-on-primary"
            >
              {item.label}
              <span className="opacity-80">({item.count})</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
