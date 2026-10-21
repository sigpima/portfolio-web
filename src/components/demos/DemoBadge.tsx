"use client";

import { useLocale, useTranslations } from "next-intl";
import type { DemoKind, Locale } from "@/content/types";

export type BadgeKind = Exclude<DemoKind, "none">;

export interface DemoBadgeProps {
  kind: BadgeKind;
  /** Route locale, for the registry-style signature; text follows the active next-intl locale. */
  locale: Locale;
}

const STYLE_BY_KIND: Record<BadgeKind, string> = {
  live: "border-secondary bg-secondary/10 text-secondary",
  replay: "border-primary bg-primary/10 text-primary",
  simulation: "border-dashed border-on-surface-variant bg-surface-container-high text-on-surface",
};

/** Decorative shape cue per kind (the label carries the meaning). */
function KindIcon({ kind }: { kind: BadgeKind }) {
  const common = {
    "aria-hidden": true,
    focusable: false,
    viewBox: "0 0 16 16",
    className: "size-4 shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "live":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" />
          <circle cx="8" cy="8" r="6" />
        </svg>
      );
    case "replay":
      return (
        <svg {...common}>
          <path d="M3 8a5 5 0 1 0 1.5-3.5" />
          <path d="M3 2.5V5h2.5" />
          <path d="M7 6v4l3-2z" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M6 2h4M7 2v4L3 13h10L9 6V2" />
        </svg>
      );
  }
}

/** Honesty label for a demo: what kind of demo this is, with a one-sentence explanation. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DemoBadge({ kind, locale: _locale }: DemoBadgeProps) {
  const t = useTranslations("demo.badge");
  const activeLocale = useLocale();
  return (
    <div lang={activeLocale} data-demo-kind={kind} className="flex flex-col items-start gap-1.5">
      <p
        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-body-md font-semibold ${STYLE_BY_KIND[kind]}`}
      >
        <KindIcon kind={kind} />
        <span>{t(`${kind}.label`)}</span>
      </p>
      <p data-role="badge-description" className="text-body-md text-on-surface-variant">
        {t(`${kind}.description`)}
      </p>
    </div>
  );
}
